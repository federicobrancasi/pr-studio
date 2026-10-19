// The changelog digest: its times (phrases of the narration, demo marks, steps) and the strip's height.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitZoom, inProof, linkProblems, loadSceneDocs, proofCorpus, resolveTime, resolveTimes, stripHeight } from '../cli/lib/digest.mjs';

// A chapter that starts 10 s into the video: "Five. VS Code links can now add a plugin marketplace."
const words = ['Five.', 'VS', 'Code', 'links', 'can', 'now', 'add', 'a', 'plugin', 'marketplace.']
	.map((display, i) => ({ display, a: 10.5 + i * 0.3, b: 10.75 + i * 0.3 }));
const ctx = {
	start: 10, words,
	targets: { dialog: { rect: [415, 254, 450, 212], windows: [[12, 14.5], [16, 18]] } },
	steps: [{ label: 'dialog', at: 12.1 }],
};

test('a time is a phrase of the narration, seconds into the chapter, a mark on screen, or a step', () => {
	assert.deepStrictEqual([
		resolveTime('links', ctx),
		resolveTime('plugin marketplace', ctx),
		resolveTime(0.35, ctx),
		resolveTime({ cue: 'links', offset: -0.15 }, ctx),
		resolveTime({ mark: 'dialog' }, ctx),
		resolveTime({ mark: 'dialog', edge: 'end', nth: 1, offset: -0.2 }, ctx),
		resolveTime({ step: 'dialog', offset: 0.3 }, ctx),
	], [11.4, 12.9, 10.35, 11.25, 12, 17.8, 12.4]);
});

test('a time that is not in the chapter says where it was looked for', () => {
	assert.throws(() => resolveTime('install', ctx, ' (c5)'), /Cue "install" is not in the narration \(c5\)/);
	assert.throws(() => resolveTime({ mark: 'toast' }, ctx), /Mark "toast" is never on screen \(marks: dialog\)/);
	assert.throws(() => resolveTime({ step: 'done' }, ctx), /Step "done" is not in the demo/);
});

test('only time keys (at, from, until, *At) are resolved, at any depth', () => {
	assert.deepStrictEqual(resolveTimes({
		at: 'links',
		text: 'links',
		rows: [{ id: 'l1', text: 'Add a plugin marketplace', at: { mark: 'dialog' } }],
		params: { swapAt: 'add', label: 'Now', highlights: [{ entry: 1, at: 1 }] },
	}, ctx), {
		at: 11.4,
		text: 'links',
		rows: [{ id: 'l1', text: 'Add a plugin marketplace', at: 12 }],
		params: { swapAt: 12.3, label: 'Now', highlights: [{ entry: 1, at: 11 }] },
	});
});

test('the strip height counts every item and its gap, and a strip of E\'s last chapter fits', () => {
	const c5 = {
		eyebrow: 'VS Code links',
		before: { rows: [{ text: 'Add a plugin marketplace', sub: 'chat-plugin/add-marketplace' }, { text: 'Install a plugin', sub: 'chat-plugin/install' }] },
		now: { rows: [{ text: 'Add Marketplace' }, { text: 'Add Marketplace and Install' }, { text: 'Plugins can run code on your machine.', tone: 'orange' }] },
	};
	const withSetting = { now: { rows: [{ text: 'On by default' }] }, setting: { name: 'a.b', state: 'On by default' } };
	assert.deepStrictEqual([stripHeight(c5), stripHeight(withSetting)], [654, 64 + 76 + 16 + 128]);
});

test('a camera focused on a mark zooms as close as the mark still fits, between 1 and 2', () => {
	// A settings row (wide), a button (small), and a whole window (no zoom).
	assert.deepStrictEqual([fitZoom([353, 210, 774, 97.8]), fitZoom([742, 431, 114, 26]), fitZoom([0, 0, 1280, 720])], [1.41, 2, 1]);
});

test('a chapter\'s strings are the PR\'s: placeholders match the values shown, shortcuts and mnemonics don\'t count', () => {
	const corpus = proofCorpus([
		'+			message: localize(\'confirm\', "Add Marketplace \'{0}\' and Install Plugin \'{1}\'?"),',
		'+			primaryButton: localize({ key: \'installButton\' }, "&&Install"),',
		'+			markdownDescription: nls.localize(\'x\', "Includes the \\`copilot\\` command that ships with VS Code."),',
		'+	title: localize(\'newNested\', "New Nested Session"),',
	].join('\n'));
	assert.deepStrictEqual([
		"Add Marketplace 'github/awesome-copilot' and Install Plugin 'ai-ready'?",
		'Install',
		'Includes the copilot command that ships with VS Code',
		'New Nested Session (⌘T)',
		'New Nested Session (Ctrl+T)',
		'GPT-5',
		'Current-chat choice',
		'',
	].map(t => inProof(corpus, t)), [true, true, true, true, true, false, false, false]);
});

test('a drawn UI must be the PR\'s, and an arrow must point at a part that is drawn and on screen', async () => {
	const kit = await loadSceneDocs();
	const corpus = proofCorpus('+	title: localize(\'newNested\', "New Nested Session"),');
	const sessions = { title: 'Sessions', rows: [{ label: 'Update the README' }], after: { icon: 'add', tooltip: 'New Nested Session' }, hoverAt: 11, tooltipAt: 12, child: { label: 'New Session', at: 14 } };
	const fake = { title: 'Model picker', rows: [{ label: 'Auto', sub: 'Org default' }], after: { icon: 'document', tooltip: 'Org default' }, hoverAt: 11 };
	const seg = (params, links) => ({ id: 'c4', start: 10, end: 20, targets: {}, spec: { now: { at: 11, rows: [{ id: 'new', text: 'x' }] }, scene: { name: 'list-actions', params }, links } });
	assert.deepStrictEqual({
		proofs: [sessions, fake].map(p => kit['list-actions'].proofs(p).map(x => inProof(corpus, x.text))),
		windows: kit['list-actions'].windows(sessions, { start: 10, end: 20 }),
		fakeWindows: Object.keys(kit['list-actions'].windows(fake, { start: 10, end: 20 })),
		ok: linkProblems(seg(sessions, [{ row: 'new', target: 'tooltip' }, { row: 'new', target: 'child' }]), kit),
		// c4: an arrow to the tooltip of a scene that never shows it, rings an empty box.
		ringsNothing: linkProblems(seg(fake, [{ row: 'new', target: 'tooltip' }]), kit).length,
		// An arrow that is gone before its target shows.
		tooEarly: linkProblems(seg(sessions, [{ row: 'new', target: 'child', until: 13.5 }]), kit).length,
	}, {
		proofs: [[true], [false]],
		windows: { row: [10, 20], action: [11, 20], tooltip: [12, 14], child: [14, 20] },
		fakeWindows: ['row', 'action'],
		ok: [],
		ringsNothing: 1,
		tooEarly: 1,
	});
});
