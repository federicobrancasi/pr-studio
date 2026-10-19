// The VS Code changelog: reading its report, and a video for each of the top picks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReport, planChangelog, topPicks } from '../cli/lib/changelog.mjs';
import { unzip } from '../cli/lib/github.mjs';
import { videoPrompt } from '../cli/lib/prompt.mjs';

// A made-up report in the format of the Changelog PR Report: the top picks, a ":::THREAD:::" line, the rest.
const REPORT = [
	'### Contoso Editor Changelog — 2026-01-15 — [Learn more](https://example.com/changelog-report.md)',
	'',
	'The most important user-facing changes merged in the last ~24h. ⚠️ flags changes worth a closer look before they reach users. More highlights in the thread 🧵.',
	'',
	'1. ⚠️ [#101 settings: turn the new file picker on by default](https://github.com/contoso/editor/pull/101) — The new file picker is now on by default in every build, so everyone gets it unless they turned it off. — _@octocat_',
	'2. ⚠️ [#102 Show sandbox rules in the status bar](https://github.com/contoso/editor/pull/102) — The status bar now shows which sandbox rules apply to the session, and `/sandbox rules` opens the full list. — _@hubot_',
	'4. ✨ [#104 chat: pick a model before the session starts](https://github.com/contoso/editor/pull/104) — The chat view now lets users choose a model and an approval level before the session starts. — _@monalisa_',
	':::THREAD:::',
	'**More highlights** from the same ~24h window:',
	'',
	'10. ✨ [#110 Keep build output visible while it streams](https://github.com/contoso/editor/pull/110) — Live build output now stays visible while a task runs instead of disappearing on each update. — _@mona_',
	'',
].join('\n');

test('the picks of a changelog report, in order, the thread apart, and the top ones that get a video', () => {
	const report = parseReport(REPORT);
	assert.deepStrictEqual({
		title: report.title,
		date: report.date,
		picks: report.picks.map(p => [p.rank, p.section, p.flag, p.warning, `${p.repo}#${p.number}`, p.title, p.author]),
		summary: report.picks[1].summary,
		top: topPicks(report).map(p => p.number),
	}, {
		title: 'Contoso Editor Changelog — 2026-01-15',
		date: '2026-01-15',
		picks: [
			[1, 'main', '⚠️', true, 'contoso/editor#101', 'settings: turn the new file picker on by default', 'octocat'],
			[2, 'main', '⚠️', true, 'contoso/editor#102', 'Show sandbox rules in the status bar', 'hubot'],
			[4, 'main', '✨', false, 'contoso/editor#104', 'chat: pick a model before the session starts', 'monalisa'],
			[10, 'thread', '✨', false, 'contoso/editor#110', 'Keep build output visible while it streams', 'mona'],
		],
		summary: 'The status bar now shows which sandbox rules apply to the session, and `/sandbox rules` opens the full list.',
		top: [101, 102, 104],
	});
});

test('every pick gets a video sized like prs new sizes it, or an error when the PR cannot be read', async () => {
	const metas = {
		101: {
			pr: { title: 'settings: turn the new file picker on by default', body: '' },
			rawFiles: [{ filename: 'src/picker/pickerConfiguration.ts', status: 'modified', additions: 1, deletions: 1, patch: '@@ -10,1 +10,1 @@\n-\t\tdefault: quality !== \'stable\',\n+\t\tdefault: true,' }],
		},
		102: {
			pr: { title: 'Show sandbox rules in the status bar', body: '' },
			rawFiles: [{ filename: 'src/status/sandboxStatus.ts', status: 'modified', additions: 180, deletions: 57 }],
		},
		110: {
			pr: { title: 'Keep build output visible while it streams', body: '' },
			rawFiles: [{ filename: 'src/tasks/buildOutput.ts', status: 'modified', additions: 20, deletions: 5, patch: '@@ -1,2 +1,3 @@\n context\n+\tthis._register(output.onDidChange(() => this.render()));' }],
		},
	};
	const fetchMeta = async ({ full, number }) => {
		if (!metas[number]) {
			throw new Error(`GitHub 404 for repos/${full}/pulls/${number}: Not Found`);
		}
		return metas[number];
	};
	const plan = await planChangelog(parseReport(REPORT), { fetchMeta });
	assert.deepStrictEqual(plan.entries.map(e => [e.number, e.kind, e.seconds, e.reasons.join('; ')]), [
		[101, 'small', 40, '2 changed lines outside tests; 1 area'],
		[102, 'large', 65, '237 changed lines outside tests; 1 area; touches security, protocols or compatibility (it says "sandbox")'],
		[104, 'error', 0, 'GitHub 404 for repos/contoso/editor/pulls/104: Not Found'],
		[110, 'small', 40, '25 changed lines outside tests; 1 area'],
	]);
});

test('the report comes out of the run artifact (a zip with deflated and stored entries)', () => {
	// Made with Python's zipfile: report.md deflated, notes.txt stored.
	const zip = Buffer.from('UEsDBBQAAAAIAGSARV0UpNnyGwAAAFgAAAAJAAAAcmVwb3J0Lm1kU1ZWVggLVnDOT0lVcM5IzEtPzclP51KmWBQAUEsDBBQAAAAAAGSARV2sJLvgDAAAAAwAAAAJAAAAbm90ZXMudHh0c3RvcmVkIGFzIGlzUEsBAhQDFAAAAAgAZIBFXRSk2fIbAAAAWAAAAAkAAAAAAAAAAAAAAIABAAAAAHJlcG9ydC5tZFBLAQIUAxQAAAAAAGSARV2sJLvgDAAAAAwAAAAJAAAAAAAAAAAAAACAAUIAAABub3Rlcy50eHRQSwUGAAAAAAIAAgBuAAAAdQAAAAAA', 'base64');
	assert.deepStrictEqual(Object.fromEntries(Object.entries(unzip(zip)).map(([name, data]) => [name, data.toString('utf8')])), {
		'report.md': '### VS Code Changelog\n'.repeat(4),
		'notes.txt': 'stored as is',
	});
});

test('the prompt of a job: the PR, where the changelog ranks it and how it describes it, and the rules to follow', () => {
	const report = parseReport(REPORT);
	const ref = { full: 'contoso/editor', number: 102 };
	const entry = report.picks.find(p => p.number === 102);
	assert.deepStrictEqual({
		inChangelog: videoPrompt(ref, { plan: { title: report.title, date: report.date }, entry }).split('\n\n'),
		alone: videoPrompt({ full: 'contoso/editor', number: 1 }).split('\n\n'),
	}, {
		inChangelog: [
			'Make the explainer video of https://github.com/contoso/editor/pull/102.',
			'It is #2 in Contoso Editor Changelog — 2026-01-15, flagged as worth a closer look before it reaches users. The changelog describes it as: "The status bar now shows which sandbox rules apply to the session, and `/sandbox rules` opens the full list." Use that to know what matters to users; every claim in the video still comes from the PR itself.',
			'Nobody is watching this run: follow .claude/skills/pr-video/guides/unattended.md and the pr-video skill it points to.',
		],
		alone: [
			'Make the explainer video of https://github.com/contoso/editor/pull/1.',
			'Nobody is watching this run: follow .claude/skills/pr-video/guides/unattended.md and the pr-video skill it points to.',
		],
	});
});
