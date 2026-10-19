// prs changelog: a video for every pick of the VS Code changelog. The changelog is the report.md that
// microsoft/vscode-engineering's "Changelog PR Report" workflow makes every morning, which the VS Code Bot posts to
// #changelog: up to 12 user-facing PRs, the top 5 first, then a ":::THREAD:::" line and the rest.
//   prs changelog                the latest report (the artifact of the last scheduled run; needs CHANGELOG_TOKEN)
//   prs changelog --run <id>     the report of one run
//   prs changelog <report.md>    a report file
// The top 5 (the picks of the main message, not the thread) get a video, sized the way prs new sizes it.
// Writes videos/_changelog/<date>.md (the report) and videos/_changelog/<date>.json (the plan).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, writeJson } from './common.mjs';
import { api, githubToken, runArtifact } from './github.mjs';
import { fetchPrMeta, lengthTier, summarizeFiles } from './fetch.mjs';
import { SECONDS, cut } from './triage.mjs';

const SOURCE = { repo: 'microsoft/vscode-engineering', workflow: 'changelog-pr-report.lock.yml', artifact: 'changelog-pr-report', file: 'report.md' };
const TOP = 5;

/** The picks of a changelog report, in its order: rank, main message or thread, flag, PR, title, summary, author. */
export function parseReport(text) {
	const lines = String(text).split('\n');
	const heading = lines.find(l => /^#{1,6}\s/.test(l)) ?? '';
	const title = heading.replace(/^#+\s*/, '').replace(/\s+[—–-]\s+\[[^\]]*\]\([^)]*\)\s*$/, '').trim();
	const picks = [];
	let section = 'main';
	for (const line of lines) {
		if (line.trim() === ':::THREAD:::') {
			section = 'thread';
			continue;
		}
		const m = line.match(/^\s*(?<rank>\d+)\.\s+(?:(?<flag>[^\s\[]+)\s+)?\[#(?<number>\d+)\s+(?<title>.*?)\]\((?<url>https?:\/\/[^)\s]+)\)(?<rest>.*)$/u);
		if (!m || picks.some(p => p.number === Number(m.groups.number))) {
			continue;
		}
		const { rest, flag = null } = m.groups;
		picks.push({
			rank: Number(m.groups.rank), section, flag, warning: /⚠/u.test(flag ?? ''),
			repo: m.groups.url.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\//)?.[1] ?? 'microsoft/vscode',
			number: Number(m.groups.number), url: m.groups.url, title: m.groups.title.trim(),
			summary: rest.replace(/\s[—–-]\s+_@[^_]+_\s*$/u, '').replace(/^\s*[—–-]\s*/u, '').trim(),
			author: rest.match(/\s[—–-]\s+_@(?<login>[^_\s]+)_\s*$/u)?.groups.login ?? null,
		});
	}
	return { title, date: title.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null, picks };
}

/** The picks that get a video: the main message's (the top 5), not the thread's. */
export function topPicks(report) {
	return report.picks.filter(p => p.section === 'main').slice(0, TOP);
}

/** One entry per pick, in the report's order, with the size of its video (small, medium, large) and its length. */
export async function planChangelog(report, { fetchMeta = fetchPrMeta } = {}) {
	const entries = await Promise.all(report.picks.map(async pick => {
		const [owner, name] = pick.repo.split('/');
		const entry = { ...pick, slug: `${owner}-${name}-${pick.number}`.toLowerCase() };
		let meta;
		try {
			meta = await fetchMeta({ full: pick.repo, owner, repo: name, number: pick.number });
		} catch (error) {
			return { ...entry, kind: 'error', seconds: 0, reasons: [String(error.message).split('\n')[0].slice(0, 160)] };
		}
		// The same sizing as prs new, so the plan matches the brief the video is made from.
		const { files, areas } = summarizeFiles(meta.rawFiles);
		const tier = lengthTier({ title: meta.pr.title, files, areas }, meta.pr.body ?? '');
		return { ...entry, kind: tier.name, seconds: SECONDS[tier.name], reasons: tier.reasons };
	}));
	return { title: report.title, date: report.date, entries };
}

/** report.md of a Changelog PR Report run: the given one, else the latest scheduled run that succeeded. */
export async function downloadReport({ run = null, token = process.env.CHANGELOG_TOKEN || githubToken() } = {}) {
	if (!token) {
		throw new Error(`Reading the changelog needs a token that can read ${SOURCE.repo}: set CHANGELOG_TOKEN`);
	}
	try {
		if (!run) {
			// Filter here, not in the query: GitHub sometimes answers the filtered query with a list that is weeks old.
			const { workflow_runs: runs } = await api(`repos/${SOURCE.repo}/actions/workflows/${SOURCE.workflow}/runs?per_page=30`, { auth: token });
			const latest = runs.filter(r => r.event === 'schedule' && r.conclusion === 'success' && r.head_branch === 'main').sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
			if (!latest) {
				throw new Error(`No successful scheduled run of ${SOURCE.workflow} in ${SOURCE.repo} among the last ${runs.length}`);
			}
			run = latest.id;
		}
		const report = (await runArtifact(SOURCE.repo, run, SOURCE.artifact, { token }))[SOURCE.file];
		if (!report?.length) {
			throw new Error(`The ${SOURCE.artifact} artifact of run ${run} has no ${SOURCE.file}`);
		}
		return { text: report.toString('utf8'), run: Number(run), url: `https://github.com/${SOURCE.repo}/actions/runs/${run}` };
	} catch (error) {
		if (/GitHub 40[134] /.test(error.message)) {
			throw new Error(`Cannot read the changelog in ${SOURCE.repo} with this token. Set CHANGELOG_TOKEN to one that can (locally: CHANGELOG_TOKEN=$(gh auth token --user <your account>))`);
		}
		throw error;
	}
}

export async function changelog({ file = null, run = null } = {}) {
	let text, source;
	if (file) {
		text = fs.readFileSync(file, 'utf8');
		source = { file: path.resolve(file) };
	} else {
		const got = await downloadReport({ run });
		text = got.text;
		source = { run: got.run, url: got.url };
	}
	const report = parseReport(text);
	if (!report.picks.length) {
		throw new Error('No pull requests in this changelog report');
	}
	const top = topPicks(report);
	const plan = await planChangelog({ ...report, picks: top });
	plan.notMade = report.picks.filter(p => !top.includes(p)).map(({ rank, number, title, url }) => ({ rank, number, title, url }));
	const date = report.date ?? new Date().toISOString().slice(0, 10);
	const dir = path.join(ROOT, 'videos', '_changelog');
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, `${date}.md`), text);
	const out = path.join(dir, `${date}.json`);
	writeJson(out, { ...plan, date, source });
	return { ...plan, date, source, file: out };
}

export function printChangelog(plan) {
	const made = plan.entries.filter(e => e.kind !== 'error');
	const count = kind => made.filter(e => e.kind === kind).length;
	const kinds = ['small', 'medium', 'large'].filter(k => count(k)).map(k => `${count(k)} ${k}`);
	const total = made.reduce((a, e) => a + e.seconds, 0);
	console.log(`${plan.title || `Changelog ${plan.date}`}: the top ${plan.entries.length}, ${made.length} video${made.length === 1 ? '' : 's'} (${kinds.join(', ')}), about ${Math.round(total / 60)} min of video\n`);
	for (const e of plan.entries) {
		const size = e.kind === 'error' ? 'ERROR' : `${e.kind.padEnd(6)} ~${e.seconds} s`;
		console.log(`${String(e.rank).padStart(2)} ${e.flag ?? '  '} ${`#${e.number}`.padEnd(8)} ${cut(e.title, 60).padEnd(60)} ${size}${e.section === 'thread' ? '  (thread)' : ''}`);
		if (e.kind === 'error') {
			console.log(`              ${e.reasons[0]}`);
		}
	}
	if (plan.notMade?.length) {
		console.log(`\nnot made (in the thread): ${plan.notMade.map(p => `#${p.number}`).join(', ')}`);
	}
	console.log(`\nfrom ${plan.source.url ?? path.relative(ROOT, plan.source.file)}\nwritten: ${path.relative(ROOT, plan.file)}`);
}
