// Offline tests for prs triage: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, firstSentence, isSourceFile, keyChange, parseChangelog, readText } from '../cli/lib/triage.mjs';

const file = (filename, additions, deletions, patch = '') => ({ filename, additions, deletions, patch, status: 'modified' });

test('changelog text: main message, then the thread; flags; links and bare numbers', () => {
	const text = [
		'1. ⚠️ #339518 sessions: enable unified workspace picker by default',
		'2. ✨ https://github.com/microsoft/vscode/pull/339626 sessions: configure cloud sandbox models',
		'---',
		'6. ⚠️ microsoft/vscode#339476 agentHost: Restore peer chats',
		'7. a duplicate of #339518 should be ignored',
	].join('\n');
	assert.deepStrictEqual(parseChangelog(text), [
		{ full: 'microsoft/vscode', number: 339518, section: 'main', flagged: true },
		{ full: 'microsoft/vscode', number: 339626, section: 'main', flagged: false },
		{ full: 'microsoft/vscode', number: 339476, section: 'thread', flagged: true },
	]);
});

test('what a source file is', () => {
	assert.deepStrictEqual(
		['src/vs/a/b.ts', 'src/vs/a/test/b.test.ts', 'README.md', 'build/lib/policies/policyData.jsonc', 'package-lock.json', 'docs/x.ts', 'build/gulpfile.js'].map(isSourceFile),
		[true, false, false, false, false, false, true],
	);
});

test('a two-line default flip is faster to read, with the key line', () => {
	const patch = "@@ -64,7 +64,7 @@\n \tproperties: {\n-\t\t\tdefault: product.quality !== 'stable',\n+\t\t\tdefault: true,\n \t\t\tscope: ConfigurationScope.APPLICATION,";
	const rawFiles = [file('src/vs/workbench/contrib/chat/browser/agentSessionsConfiguration.ts', 1, 1, patch), file('src/vs/workbench/contrib/chat/test/browser/chatConfiguration.test.ts', 16, 1)];
	const pr = { title: 'sessions: enable unified workspace picker by default', body: '' };
	const c = classify({ pr, rawFiles });
	assert.deepStrictEqual({ decision: c.decision, sourceLines: c.sourceLines, sourceFiles: c.sourceFiles, testFiles: c.testFiles }, { decision: 'read', sourceLines: 2, sourceFiles: 1, testFiles: 1 });
	assert.deepStrictEqual(keyChange(rawFiles), { file: 'agentSessionsConfiguration.ts', before: "default: product.quality !== 'stable',", after: 'default: true,' });
	const line = readText({ url: 'https://x/1', number: 1, title: pr.title, what: 'Enables it.', key: keyChange(rawFiles) });
	assert.equal(line, "<https://x/1|#1> *sessions: enable unified workspace picker by default*: Enables it. `default: product.quality !== 'stable'` \u2192 `default: true` (agentSessionsConfiguration.ts)");
});

test('size, mechanical titles and tiers', () => {
	const many = n => Array.from({ length: n }, (_, i) => file(`src/vs/workbench/contrib/feature${i % 3}/browser/f${i}.ts`, 30, 10));
	assert.equal(classify({ pr: { title: 'Bump typescript to 6.1', body: '' }, rawFiles: many(4) }).decision, 'read');
	assert.equal(classify({ pr: { title: 'Update tests', body: '' }, rawFiles: [file('src/vs/a/test/x.test.ts', 200, 0)] }).decision, 'read');
	const small = classify({ pr: { title: 'Tweak a list', body: '' }, rawFiles: many(2) });
	assert.deepStrictEqual([small.decision, small.tier], ['video', 'small']);
	const bumped = classify({ pr: { title: 'Handle permissive sandbox retry approvals', body: '' }, rawFiles: many(2) });
	assert.deepStrictEqual([bumped.decision, bumped.tier], ['video', 'medium']);
	const large = classify({ pr: { title: 'Refactor', body: '' }, rawFiles: many(30) });
	assert.deepStrictEqual([large.decision, large.tier], ['video', 'large']);
});

test("the author's first sentence, without template comments or headings", () => {
	const body = '<!-- Thank you for submitting a Pull Request. -->\n\n## Summary\n\nEnables the picker by default for Stable. Explicit settings are unchanged.\n\nFixes #1';
	assert.equal(firstSentence(body), 'Enables the picker by default for Stable.');
	assert.equal(firstSentence('Fixes #12'), '');
});

test('the PRs named in a request, including bare numbers', async () => {
	const { requestRefs } = await import('../cli/lib/prefetch.mjs');
	const text = 'video 339632 and video anyway #339518, also https://github.com/microsoft/vscode-copilot-chat/pull/1234 and microsoft/typescript#56789; not 2026-10-05, not 12:00, not port 3000';
	assert.deepStrictEqual(requestRefs(text).map(r => `${r.full}#${r.number}`), [
		'microsoft/vscode#339632', 'microsoft/vscode#339518', 'microsoft/vscode-copilot-chat#1234', 'microsoft/typescript#56789',
	]);
});

test('minutes left in a cloud session: its own clock, else /tmp/prs-start, else none', async () => {
	const { minutesLeft } = await import('../cli/lib/triage.mjs');
	const fs = await import('node:fs');
	const os = await import('node:os');
	const path = await import('node:path');
	const now = 1_790_000_000;
	const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prs-budget-')), 'start');
	fs.writeFileSync(file, `${now - 30 * 60}\n`);
	const missing = `${file}-missing`;
	assert.deepStrictEqual({
		session: minutesLeft({ env: { COPILOT_AGENT_START_TIME_SEC: String(now - 10 * 60), COPILOT_AGENT_TIMEOUT_MIN: '59' }, now, startFile: missing }),
		notEpochSeconds: minutesLeft({ env: { COPILOT_AGENT_START_TIME_SEC: String((now - 10 * 60) * 1000) }, now, startFile: file }),
		fromFile: minutesLeft({ env: {}, now, startFile: file }),
		none: minutesLeft({ env: {}, now, startFile: missing }),
	}, { session: 49, notEpochSeconds: 29, fromFile: 29, none: null });
	fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
