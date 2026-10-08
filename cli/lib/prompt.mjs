// prs prompt: the prompt for a run nobody watches (a GitHub Actions job): make the video of one PR.
// When the PR is in a saved changelog plan (videos/_changelog/<date>.json, written by prs changelog), the prompt
// also says where the changelog ranks it and how it describes it.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parsePrRef, readJson } from './common.mjs';

const CHANGELOG_DIR = path.join(ROOT, 'videos', '_changelog');

/** The newest changelog plan that has this PR, as { plan, entry }; null when none does. */
export function findInChangelog(ref, dir = CHANGELOG_DIR) {
	if (!fs.existsSync(dir)) {
		return null;
	}
	for (const file of fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()) {
		const plan = readJson(path.join(dir, file));
		const entry = plan.entries.find(e => e.repo === ref.full && e.number === ref.number);
		if (entry) {
			return { plan, entry };
		}
	}
	return null;
}

export function videoPrompt(ref, found = null) {
	const lines = [`Make the explainer video of https://github.com/${ref.full}/pull/${ref.number}.`];
	if (found) {
		const { plan, entry } = found;
		const where = plan.title || `the VS Code changelog of ${plan.date}`;
		lines.push(`It is #${entry.rank} in ${where}${entry.warning ? ', flagged as worth a closer look before it reaches users' : ''}. The changelog describes it as: "${entry.summary}" Use that to know what matters to users; every claim in the video still comes from the PR itself.`);
	}
	lines.push('Nobody is watching this run: follow .claude/skills/pr-video/guides/unattended.md and the pr-video skill it points to.');
	return lines.join('\n\n');
}

/** The prompt for a PR reference (a URL, owner/repo#n, or a number in repo). */
export function prompt(input, { repo = 'microsoft/vscode' } = {}) {
	const ref = /^#?\d+$/.test(String(input)) ? parsePrRef(`${repo}#${String(input).replace('#', '')}`) : parsePrRef(input);
	return videoPrompt(ref, findInChangelog(ref));
}
