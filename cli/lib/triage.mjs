// prs triage: which PRs get a video, which are faster to read, and in what order.
//   prs triage <PR URLs or refs...>          on demand (no cap)
//   prs triage --file changelog.txt [--cap 3] a #changelog message: the main message, a line "---", then the thread
// Writes videos/_triage/<date>.json and prints the Slack-ready lines.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig, parsePrRef, writeJson } from './common.mjs';
import { readHistory } from './history.mjs';
import { fetchPrMeta, isTestFile, lengthTier, summarizeFiles } from './fetch.mjs';

const GENERATED = /(^|\/)(policyData\.jsonc|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|cglicenses\.json|cgmanifest\.json|ThirdPartyNotices\.txt)$|\.snap$|\.(png|jpe?g|gif|ico|woff2?|ttf|mp4|webm)$/i;
const DOCS = /\.(md|mdx|rst)$|(^|\/)docs?\//i;
const MECHANICAL = /^(revert\b|bump\b|update distro\b|update (dependency|dependencies|electron|node(js)?|version)\b|chore\(deps\)|merge (branch|remote-tracking))/i;
/** About how long a video of each size runs, for planning a batch (measured on short videos: small 37 s, medium 38-51 s). */
export const SECONDS = { small: 40, medium: 50, large: 65 };

export const isSourceFile = p => !isTestFile(p) && !DOCS.test(p) && !GENERATED.test(p);

/** The author's first sentence: what the PR does, in their words. */
export function firstSentence(body) {
	const paragraphs = String(body ?? '').replace(/<!--[\s\S]*?-->/g, '').split(/\n\s*\n/).map(p => p.trim())
		.filter(p => p && !/^(#|>|\||```|[-*] \[)/.test(p) && !/^(fixes|closes|resolves|related to|part of|tracking:?|refs?:?)\b/i.test(p));
	const flat = (paragraphs[0] ?? '').replace(/\s+/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '');
	const m = flat.match(/^(.{20,260}?[.!?])(\s|$)/);
	return (m ? m[1] : flat.slice(0, 260)).trim();
}

/** The most telling changed line of a small PR: a replaced line (before -> after), else the first meaningful addition. */
export function keyChange(rawFiles) {
	const source = rawFiles.filter(f => isSourceFile(f.filename)).sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions));
	const meaningful = t => t.trim().length > 3 && !/^\s*(\/\/|\*|\/\*|import\b|export \* from|[{}()[\];,]+$)/.test(t);
	for (const f of source) {
		const lines = String(f.patch ?? '').split('\n');
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].startsWith('-') && meaningful(lines[i].slice(1))) {
				const j = lines.slice(i + 1, i + 6).findIndex(l => l.startsWith('+') && meaningful(l.slice(1)));
				if (j >= 0) {
					return { file: f.filename.split('/').pop(), before: lines[i].slice(1).trim(), after: lines[i + 1 + j].slice(1).trim() };
				}
			}
		}
		const add = lines.find(l => l.startsWith('+') && meaningful(l.slice(1)));
		if (add) {
			return { file: f.filename.split('/').pop(), after: add.slice(1).trim() };
		}
	}
	return null;
}

/** Reads PR references and their place (main message or thread, flagged or not) from changelog text. */
export function parseChangelog(text, defaultRepo = 'microsoft/vscode') {
	const items = [];
	let section = 'main';
	for (const line of String(text).split('\n')) {
		if (/^\s*-{3,}\s*$/.test(line) || /^\s*(thread|replies)\s*:?\s*$/i.test(line)) {
			section = 'thread';
			continue;
		}
		const flagged = /⚠️|⚠|:warning:/.test(line);
		const refs = [];
		for (const m of line.matchAll(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g)) {
			refs.push({ full: m[1], number: Number(m[2]) });
		}
		if (!refs.length) {
			for (const m of line.matchAll(/(?:^|[\s(])(?:([\w.-]+\/[\w.-]+))?#(\d{3,7})\b/g)) {
				refs.push({ full: m[1] ?? defaultRepo, number: Number(m[2]) });
			}
		}
		for (const r of refs) {
			if (!items.some(x => x.full === r.full && x.number === r.number)) {
				items.push({ ...r, section, flagged });
			}
		}
	}
	return items;
}

export function classify({ pr, rawFiles }) {
	const src = rawFiles.filter(f => isSourceFile(f.filename));
	const srcLines = src.reduce((a, f) => a + f.additions + f.deletions, 0);
	const { files, areas } = summarizeFiles(src);
	const tests = rawFiles.filter(f => isTestFile(f.filename)).length;
	const base = { sourceLines: srcLines, sourceFiles: src.length, areas: areas.length, testFiles: tests };
	if (!src.length) {
		return { ...base, decision: 'read', reasons: ['only tests, docs or generated files change'] };
	}
	if (MECHANICAL.test(pr.title)) {
		return { ...base, decision: 'read', reasons: ['a mechanical change (revert, bump or update)'] };
	}
	if (srcLines <= 25 && src.length <= 2) {
		return { ...base, decision: 'read', reasons: [`${srcLines} source line${srcLines === 1 ? '' : 's'} in ${src.length} file${src.length === 1 ? '' : 's'}: faster to read than to watch`] };
	}
	const tier = lengthTier({ title: pr.title, files, areas }, pr.body ?? '');
	return { ...base, decision: 'video', tier: tier.name, seconds: SECONDS[tier.name], reasons: tier.reasons };
}

export const cut = (s, n) => {
	const t = s.replace(/[,;]\s*$/, '');
	return t.length > n ? `${t.slice(0, n - 1)}\u2026` : t;
};
const approx = s => (s < 60 ? `${Math.round(s / 10) * 10} s` : `${Math.floor(s / 60)}:${String(Math.round((s % 60) / 10) * 10).padStart(2, '0')}`);

/** Slack mrkdwn lines for one PR (the reply for "read it" and over-cap PRs). */
export function readText(e) {
	const link = `<${e.url}|#${e.number}>`;
	const key = e.key ? (e.key.before ? ` \`${cut(e.key.before, 70)}\` \u2192 \`${cut(e.key.after, 70)}\` (${e.key.file})` : ` Key line: \`${cut(e.key.after, 90)}\` (${e.key.file})`) : '';
	return `${link} *${e.title}*: ${e.what || e.title}${key}`;
}

export async function triage(inputs, { file = null, cap = null, repo = 'microsoft/vscode', out = null } = {}) {
	let items = [];
	if (file) {
		items = parseChangelog(fs.readFileSync(file, 'utf8'), repo);
	}
	for (const input of inputs) {
		const ref = /^#?\d+$/.test(String(input)) ? parsePrRef(`${repo}#${String(input).replace('#', '')}`) : parsePrRef(input);
		if (!items.some(x => x.full === ref.full && x.number === ref.number)) {
			items.push({ full: ref.full, number: ref.number, section: file ? 'main' : 'request', flagged: false });
		}
	}
	if (!items.length) {
		throw new Error('No pull requests found: pass PR URLs, or --file with the #changelog text (main message, a line ---, then the thread)');
	}
	const entries = await Promise.all(items.map(async (it, order) => {
		const [owner, name] = it.full.split('/');
		let meta;
		try {
			meta = await fetchPrMeta({ full: it.full, owner, repo: name, number: it.number });
		} catch (error) {
			// One unreadable PR (a typo, the agent firewall) must not sink the rest of the changelog.
			return {
				order, ...it, slug: `${owner}-${name}-${it.number}`.toLowerCase(), url: `https://github.com/${it.full}/pull/${it.number}`, title: `#${it.number}`,
				decision: 'error', reasons: [String(error.message).split('\n')[0].slice(0, 160)], sourceLines: 0, sourceFiles: 0,
			};
		}
		const c = classify(meta);
		return {
			order, ...it, slug: `${owner}-${name}-${it.number}`.toLowerCase(), url: meta.pr.html_url, title: meta.pr.title,
			author: meta.pr.user.login, merged: !!meta.pr.merged_at, what: firstSentence(meta.pr.body), key: c.decision === 'read' ? keyChange(meta.rawFiles) : null, ...c,
		};
	}));
	// Order: the main message before its thread, flagged (⚠️) first, otherwise the changelog's own order (it is
	// curated by importance); on-demand requests keep the order they were given in.
	const rankKey = e => [e.section === 'request' ? 0 : e.section === 'main' ? 1 : 2, e.flagged ? 0 : 1, e.order];
	const byRank = [...entries].sort((a, b) => {
		const x = rankKey(a), y = rankKey(b);
		for (let i = 0; i < x.length; i++) {
			if (x[i] !== y[i]) {
				return x[i] - y[i];
			}
		}
		return 0;
	});
	const limit = cap ?? (file ? 3 : Infinity);
	let videos = 0;
	for (const e of byRank) {
		if (e.decision === 'video' && e.section !== 'request') {
			if (videos >= limit) {
				e.decision = 'later';
				e.reasons = [...e.reasons, `over today's cap of ${limit} videos`];
			} else {
				videos++;
			}
		}
	}
	const date = new Date().toISOString().slice(0, 10);
	const result = { date, cap: limit === Infinity ? null : limit, entries: byRank };
	result.slack = slackPlan(result);
	const target = out ?? path.join(ROOT, 'videos', '_triage', `${date}${file ? '' : `-request-${byRank.map(e => e.number).join('-')}`}.json`);
	writeJson(target, result);
	result.file = target;
	return result;
}

export function slackPlan({ entries }) {
	const v = entries.filter(e => e.decision === 'video'), r = entries.filter(e => e.decision === 'read'), l = entries.filter(e => e.decision === 'later'), x = entries.filter(e => e.decision === 'error');
	const lines = [`*${entries.length} PR${entries.length === 1 ? '' : 's'}: ${v.length} video${v.length === 1 ? '' : 's'} coming, ${r.length} faster to read${l.length ? `, ${l.length} for another day` : ''}${x.length ? `, ${x.length} I couldn't read` : ''}.*`];
	if (v.length) {
		lines.push('', ':clapper: *Videos, in this order*');
		v.forEach((e, i) => lines.push(`${i + 1}. <${e.url}|#${e.number}> ${e.title} (about ${approx(e.seconds)})`));
	}
	if (r.length) {
		lines.push('', ':open_book: *Faster to read*');
		r.forEach(e => lines.push(`\u2022 ${readText(e)}`));
	}
	if (l.length) {
		lines.push('', `:fast_forward: *Not today* (reply \`video <number>\` for one): ${l.map(e => `<${e.url}|#${e.number}>`).join(', ')}`);
	}
	if (x.length) {
		lines.push('', `:warning: *Couldn't read* ${x.map(e => `<${e.url}|#${e.number}>`).join(', ')}: ${x[0].reasons[0]}`);
	}
	return lines.join('\n');
}

/** The closing Slack message after the videos: one line per PR, in triage order. */
export function summary(file) {
	const result = JSON.parse(fs.readFileSync(file, 'utf8'));
	const deliver = loadConfig().deliver;
	const history = new Map(readHistory().map(h => [h.slug, h]));
	const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
	const lines = [];
	for (const e of result.entries) {
		const mp4 = path.join(deliver, e.slug, `${e.slug}.mp4`);
		if (e.decision === 'video') {
			const h = history.get(e.slug);
			lines.push(fs.existsSync(mp4) && h
				? `:clapper: <${e.url}|#${e.number}> *${h.headline ?? e.title}* (${mmss(h.seconds)})`
				: `:warning: <${e.url}|#${e.number}> ${e.title}: no video this time (reply \`video ${e.number}\` to try again)`);
		} else if (e.decision === 'read') {
			lines.push(`:open_book: ${readText(e)}`);
		} else if (e.decision === 'error') {
			lines.push(`:warning: <${e.url}|#${e.number}>: couldn't read it (${e.reasons[0]})`);
		} else {
			lines.push(`:fast_forward: <${e.url}|#${e.number}> ${e.title} (reply \`video ${e.number}\` for one)`);
		}
	}
	return lines.join('\n');
}

/**
 * Whole minutes left in a Copilot cloud session (59 at most): from the session's own start time when the agent
 * environment provides it, else from /tmp/prs-start (written at the start of a Slack run). null outside a session.
 */
export function minutesLeft({ env = process.env, now = Date.now() / 1000, startFile = '/tmp/prs-start' } = {}) {
	const limit = Math.min(59, Number(env.COPILOT_AGENT_TIMEOUT_MIN) || 59);
	let start = Number(env.COPILOT_AGENT_START_TIME_SEC);
	if (!(start > now - 4 * 3600 && start <= now + 60)) {
		start = fs.existsSync(startFile) ? Number(fs.readFileSync(startFile, 'utf8').trim()) : NaN;
	}
	return Number.isFinite(start) && start > 0 ? Math.floor((start + limit * 60 - now) / 60) : null;
}

export function printTriage(result) {
	const icon = { video: 'VIDEO', read: 'READ ', later: 'LATER', error: 'ERROR' };
	for (const e of result.entries) {
		console.log(`${icon[e.decision]} #${e.number}  ${e.decision === 'video' ? `${e.tier.padEnd(6)} ~${e.seconds}s` : '          '}  src ${String(e.sourceLines).padStart(4)} lines/${String(e.sourceFiles).padStart(2)} files  ${e.section}${e.flagged ? ' \u26a0' : ''}  ${e.title.slice(0, 70)}`);
		console.log(`        ${e.reasons.join('; ')}`);
	}
	console.log(`\nwritten: ${path.relative(ROOT, result.file)}\n\n--- Slack ---\n${result.slack}`);
}
