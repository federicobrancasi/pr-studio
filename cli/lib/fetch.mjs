// prs new: fetch a pull request (any repo) into videos/<slug>/: pr.json, pr.diff, brief.md and a storyboard skeleton.
import fs from 'node:fs';
import path from 'node:path';
import { parsePrRef, videoDir, writeJson } from './common.mjs';
import { parseDiff } from './code.mjs';
import { api, graphql, paginate, prDiff } from './github.mjs';

export function isTestFile(p) {
	return /(^|\/)(test|tests|__tests__|spec)\//.test(p) || /[._-](test|spec|integrationTest)\.[^/]+$/i.test(p) || /(^|\/)test_[^/]+\.py$/.test(p);
}

export function deriveArea(p) {
	const s = p.split('/');
	if (s[0] === 'src' && s[1] === 'vs') {
		const [, , layer, scope, feature] = s;
		if (layer === 'platform' && scope) {
			return `platform/${scope}`;
		}
		if (layer === 'workbench' && ['services', 'contrib', 'api'].includes(scope) && feature) {
			return `workbench/${scope}/${feature}`;
		}
		if (layer && scope && s.length > 4) {
			return `${layer}/${scope}`;
		}
		return layer ?? p;
	}
	if (s[0] === 'extensions' && s[1]) {
		return `extensions/${s[1]}`;
	}
	return s.length > 2 ? `${s[0]}/${s[1]}` : s.length === 2 ? s[0] : '(root)';
}

const DECL = [
	/\b(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
	/\b(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/,
	/\b(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/,
	/\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*=/,
	/\b(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
	/^\s*(?:(?:public|private|protected|static|readonly|override|abstract|async|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^)]*\)?\s*(?::\s*[^={]+)?\{?\s*$/,
	/\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/,
	/^\s*def\s+([A-Za-z_]\w*)/, /^\s*class\s+([A-Za-z_]\w*)/,
	/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, /^\s*(?:pub\s+)?fn\s+([A-Za-z_]\w*)/,
];
const NOT_NAMES = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'constructor', 'super', 'await', 'new', 'else', 'do', 'try']);

function declName(line) {
	for (const re of DECL) {
		const m = line.match(re);
		if (m && !NOT_NAMES.has(m[1])) {
			return m[1];
		}
	}
	return null;
}

export function symbolsFromDiff(diffFiles) {
	const out = [];
	for (const [p, file] of diffFiles) {
		const added = new Set(), removed = new Set(), within = new Set();
		for (const h of file.hunks) {
			const ctxName = declName(h.header) ?? (h.header.match(/([A-Za-z_$][\w$]*)\s*\(/)?.[1]);
			if (ctxName && !NOT_NAMES.has(ctxName)) {
				within.add(ctxName);
			}
			for (const l of h.lines) {
				const n = l.type !== ' ' ? declName(l.text) : null;
				if (n) {
					(l.type === '+' ? added : removed).add(n);
				}
			}
		}
		const both = [...added].filter(n => removed.has(n));
		out.push({
			path: p,
			added: [...added].filter(n => !removed.has(n)),
			removed: [...removed].filter(n => !added.has(n)),
			changed: [...new Set([...both, ...[...within].filter(n => !added.has(n) && !removed.has(n))])],
		});
	}
	return out;
}

export function testsFromDiff(diffFiles) {
	const out = [];
	for (const [p, file] of diffFiles) {
		if (!isTestFile(p)) {
			continue;
		}
		const names = [];
		for (const h of file.hunks) {
			for (const l of h.lines) {
				if (l.type !== '+') {
					continue;
				}
				const m = l.text.match(/\b(?:test|it|suite|describe)\s*\(\s*(['"`])((?:\\.|(?!\1).)+)\1/) ?? l.text.match(/^\s*def\s+(test_\w+)/);
				if (m) {
					names.push(m[2] ?? m[1]);
				}
			}
		}
		out.push({ path: p, names });
	}
	return out;
}

export function lengthTier(facts, body = '') {
	const nonTest = facts.files.filter(f => !f.isTest).reduce((a, f) => a + f.additions + f.deletions, 0);
	const areas = facts.areas.length;
	let tier = nonTest <= 150 && areas <= 2 ? 0 : nonTest <= 600 && areas <= 4 ? 1 : 2;
	const reasons = [`${nonTest} changed lines outside tests`, `${areas} area${areas === 1 ? '' : 's'}`];
	if (tier < 2 && /\b(security|auth\w*|token|credential|protocol|ipc|migration|breaking|permission|sandbox|encrypt\w*)\b/i.test(`${facts.title}\n${body}`)) {
		tier++;
		reasons.push('touches security, protocols or compatibility');
	}
	return [
		// About 2 words per second with the pauses: measured on MAI-Voice-2 (1.9-2.05) and Kokoro (1.93) narrations.
		{ name: 'small', seconds: [40, 55], words: [80, 110], beats: 4, reasons },
		{ name: 'medium', seconds: [60, 80], words: [120, 160], beats: 5, reasons },
		{ name: 'large', seconds: [85, 100], words: [170, 200], beats: 6, reasons },
	][tier];
}

/** Review state the way GitHub summarizes it, from the reviews themselves (GraphQL gives it directly when we have a token). */
function reviewDecisionFrom(reviews, author, open) {
	const latest = new Map();
	for (const r of reviews) {
		if (r.user?.login && r.user.login !== author && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) {
			latest.set(r.user.login, r.state);
		}
	}
	const states = [...latest.values()];
	return states.includes('CHANGES_REQUESTED') ? 'CHANGES_REQUESTED' : states.includes('APPROVED') ? 'APPROVED' : open ? 'REVIEW_REQUIRED' : null;
}

/** "Fixes #123" / "closes owner/repo#123" in the body (GitHub's closing keywords), when GraphQL isn't available. */
export function closingRefs(body, full) {
	const out = [];
	for (const m of body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/|([\w.-]+\/[\w.-]+)?#)(\d+)/gi)) {
		const repo = m[1] ?? m[2] ?? full;
		if (repo.toLowerCase() === full.toLowerCase() && !out.some(i => i.number === Number(m[3]))) {
			out.push({ number: Number(m[3]), title: '', url: `https://github.com/${full}/issues/${m[3]}` });
		}
	}
	return out;
}

/** The PR's numbers and lists from REST (a token helps but isn't required). */
export async function fetchPrMeta(ref) {
	const [pr, rawFiles] = await Promise.all([
		api(`repos/${ref.full}/pulls/${ref.number}`),
		paginate(`repos/${ref.full}/pulls/${ref.number}/files`),
	]);
	return { pr, rawFiles };
}

export function summarizeFiles(rawFiles) {
	const files = rawFiles.map(f => ({ path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, area: deriveArea(f.filename), isTest: isTestFile(f.filename) }));
	const areasMap = new Map();
	for (const f of files) {
		const a = areasMap.get(f.area) ?? { name: f.area, files: 0, additions: 0, deletions: 0 };
		a.files++;
		a.additions += f.additions;
		a.deletions += f.deletions;
		areasMap.set(f.area, a);
	}
	return { files, areas: [...areasMap.values()].sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions)) };
}

export async function fetchPr(ref) {
	const { pr, rawFiles } = await fetchPrMeta(ref);
	const [commits, reviews, diffText, extra] = await Promise.all([
		paginate(`repos/${ref.full}/pulls/${ref.number}/commits`),
		paginate(`repos/${ref.full}/pulls/${ref.number}/reviews`),
		prDiff(ref.full, ref.number).catch(() => null),
		graphql('query($o:String!,$n:String!,$p:Int!){repository(owner:$o,name:$n){pullRequest(number:$p){reviewDecision closingIssuesReferences(first:10){nodes{number title url}}}}}', { o: ref.owner, n: ref.repo, p: ref.number }),
	]);
	const diff = diffText ?? rawFiles.map(f => `diff --git a/${f.filename} b/${f.filename}\n--- a/${f.previous_filename ?? f.filename}\n+++ b/${f.filename}\n${f.patch ?? ''}`).join('\n');
	const latest = await api(`repos/${ref.full}/pulls/${ref.number}`);
	if (latest.head.sha !== pr.head.sha) {
		throw new Error('The PR got new commits while fetching; run prs new again');
	}
	const { files, areas } = summarizeFiles(rawFiles);
	const author = pr.user.login;
	const remote = extra?.repository?.pullRequest;
	const state = pr.merged_at ? 'MERGED' : pr.state.toUpperCase();
	const facts = {
		repo: ref.full, number: pr.number, url: pr.html_url, title: pr.title, authorLogin: author, state, isDraft: !!pr.draft,
		createdAt: pr.created_at, updatedAt: pr.updated_at, mergedAt: pr.merged_at, baseRef: pr.base.ref, headRef: pr.head.ref,
		baseSha: pr.base.sha, headSha: pr.head.sha, headSha9: pr.head.sha.slice(0, 9),
		additions: pr.additions, deletions: pr.deletions, changedFiles: pr.changed_files, commitCount: commits.length,
		reviewDecision: remote ? (remote.reviewDecision || null) : reviewDecisionFrom(reviews, author, state === 'OPEN'),
		labels: pr.labels.map(l => l.name), fetchedAt: new Date().toISOString(),
		commits: commits.map(c => {
			const [headline, ...rest] = c.commit.message.split('\n');
			return { sha9: c.sha.slice(0, 9), headline, message: `${headline}\n${rest.join('\n').replace(/^\n+/, '')}`.trim() };
		}),
		files, areas,
		testFiles: files.filter(f => f.isTest).length,
		linkedIssues: remote
			? (remote.closingIssuesReferences?.nodes ?? []).map(i => ({ number: i.number, title: i.title ?? '', url: i.url }))
			: closingRefs(pr.body ?? '', ref.full),
		reviewers: [...new Set(reviews.filter(r => r.user?.login && r.user.login !== author).map(r => r.user.login))],
		reviewCount: reviews.length,
	};
	const diffFiles = parseDiff(diff);
	return { facts, body: pr.body ?? '', diff, symbols: symbolsFromDiff(diffFiles), tests: testsFromDiff(diffFiles), tier: lengthTier(facts, pr.body ?? '') };
}

const signed = (a, d) => `+${a} \u2212${d}`;
const date = iso => new Date(iso).toISOString().slice(0, 10);

export function writeBrief(dir, data) {
	const { facts: f, body, symbols, tests, tier } = data;
	const lines = [];
	lines.push(`# PR video brief: ${f.repo}#${f.number}`, '');
	lines.push(`**${f.title}**`, '');
	lines.push(`- by @${f.authorLogin} \u00b7 ${f.isDraft ? 'draft' : f.state.toLowerCase()}${f.reviewDecision ? ` \u00b7 ${f.reviewDecision.toLowerCase().replace(/_/g, ' ')}` : ''}${f.reviewers.length ? ` \u00b7 reviewed by ${f.reviewers.map(r => `@${r}`).join(', ')}` : ''}`);
	lines.push(`- ${signed(f.additions, f.deletions)} in ${f.changedFiles} files (${f.testFiles} test files) \u00b7 ${f.commitCount} commits \u00b7 head ${f.headSha9} \u00b7 opened ${date(f.createdAt)} \u00b7 fetched ${date(f.fetchedAt)}`);
	lines.push(`- ${f.url}`, '');
	lines.push('## Length', '');
	lines.push(`**${tier.name}** (${tier.reasons.join(', ')}): aim for **${tier.seconds[0]}\u2013${tier.seconds[1]} s** of narration, about ${tier.words[0]}\u2013${tier.words[1]} words, in **${tier.beats} beats**: the title beat, ${tier.beats - 2} explanation beats, and a closing status beat.`, '');
	lines.push('## What the author says (PR body, verbatim)', '');
	const b = body.trim() || '(empty)';
	lines.push(b.length > 9000 ? `${b.slice(0, 9000)}\n\n[\u2026 ${b.length - 9000} more characters in pr.json]` : b, '');
	lines.push('## Commits', '');
	for (const c of f.commits) {
		lines.push(`- \`${c.sha9}\` ${c.headline}`);
	}
	lines.push('', '## Files by area', '');
	for (const a of f.areas) {
		lines.push(`- **${a.name}** (${signed(a.additions, a.deletions)})`);
		for (const file of f.files.filter(x => x.area === a.name).sort((x, y) => (y.additions + y.deletions) - (x.additions + x.deletions))) {
			lines.push(`  - \`${file.path}\` ${signed(file.additions, file.deletions)}${file.isTest ? ' (test)' : ''}${file.status !== 'modified' ? ` (${file.status})` : ''}`);
		}
	}
	lines.push('', '## Symbols touched (from the diff)', '');
	for (const s of symbols) {
		const parts = [];
		if (s.added.length) {
			parts.push(`added ${s.added.slice(0, 12).map(n => `\`${n}\``).join(', ')}`);
		}
		if (s.removed.length) {
			parts.push(`removed ${s.removed.slice(0, 12).map(n => `\`${n}\``).join(', ')}`);
		}
		if (s.changed.length) {
			parts.push(`edited in ${s.changed.slice(0, 12).map(n => `\`${n}\``).join(', ')}`);
		}
		if (parts.length) {
			lines.push(`- \`${s.path}\`: ${parts.join('; ')}`);
		}
	}
	if (tests.some(t => t.names.length)) {
		lines.push('', '## Tests added or changed', '');
		for (const t of tests.filter(x => x.names.length)) {
			lines.push(`- \`${t.path}\`: ${t.names.slice(0, 15).map(n => `"${n}"`).join(', ')}${t.names.length > 15 ? ` (+${t.names.length - 15} more)` : ''}`);
		}
	}
	if (f.linkedIssues.length) {
		lines.push('', '## Linked issues', '');
		for (const i of f.linkedIssues) {
			lines.push(`- #${i.number} ${i.title}`);
		}
	}
	lines.push('', '## Next', '');
	lines.push('1. Read the diff where it matters: `videos/<slug>/pr.diff` (search it; don\'t read it all).');
	lines.push('2. Write `storyboard.json` (see `.claude/skills/pr-video/guides/story.md`), then `prs check`.');
	lines.push('3. `prs voice --background`, then `prs direct` and fill in `scenes.js` (see `guides/visuals.md`).');
	lines.push('4. `prs stills`, look, fix; `prs lint`; `prs render`; `prs publish`.');
	fs.writeFileSync(path.join(dir, 'brief.md'), `${lines.join('\n')}\n`);
}

export async function newVideo(input, second, { force = false } = {}) {
	const ref = parsePrRef(input, second);
	const dir = videoDir(ref.slug);
	if (fs.existsSync(path.join(dir, 'storyboard.json')) && !force) {
		throw new Error(`videos/${ref.slug} already exists. Continue there, or run prs new ${input} --force to refetch (keeps your storyboard and scenes).`);
	}
	fs.mkdirSync(dir, { recursive: true });
	const data = await fetchPr(ref);
	writeJson(path.join(dir, 'pr.json'), { facts: data.facts, body: data.body, symbols: data.symbols, tests: data.tests, tier: data.tier });
	fs.writeFileSync(path.join(dir, 'pr.diff'), data.diff);
	writeBrief(dir, data);
	const sb = path.join(dir, 'storyboard.json');
	if (!fs.existsSync(sb)) {
		const middle = Array.from({ length: data.tier.beats - 2 }, (_, i) => ({ id: `beat${i + 2}`, need: 'TODO', say: 'TODO', cues: {}, claims: [] }));
		writeJson(sb, {
			pr: { repo: ref.full, number: ref.number, headSha: data.facts.headSha },
			length: { seconds: data.tier.seconds, words: data.tier.words },
			pronounce: {},
			beats: [
				{ id: 'title', need: 'title', say: `Pull request {{facts.number}}, by {{facts.authorLogin}}: TODO what it does. {{facts.additions}} lines added across {{facts.changedFiles}} files.`, cues: { author: 'by', stats: '{{facts.additions}}' }, claims: [] },
				...middle,
				{ id: 'status', need: 'status', say: 'TODO', cues: {}, claims: [] },
			],
		});
	}
	return { ref, data };
}
