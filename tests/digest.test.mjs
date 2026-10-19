// The changelog digest: its times (phrases of the narration, demo marks, steps) and the strip's height.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitZoom, focusShows, iconsOf, inProof, loadSceneDocs, planFocus, proofCorpus, resolveTime, resolveTimes, steadyFrom, stripHeight } from '../cli/lib/digest.mjs';

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

test('a drawn UI must be the PR\'s, and its one arrow goes up only once its row is in and its part is drawn', async () => {
	const kit = await loadSceneDocs();
	const corpus = proofCorpus('+	title: localize(\'newNested\', "New Nested Session"),');
	const sessions = { title: 'Sessions', rows: [{ label: 'Update the README' }], after: { icon: 'add', tooltip: 'New Nested Session' }, hoverAt: 11, tooltipAt: 12, child: { label: 'New Session', at: 14 } };
	const fake = { title: 'Model picker', rows: [{ label: 'Auto', sub: 'Org default' }], after: { icon: 'document', tooltip: 'Org default' }, hoverAt: 11 };
	const spec = (params, focus, extra = {}) => ({ now: { at: 11, rows: [{ id: 'new', text: 'x' }] }, scene: { name: 'list-actions', params }, focus, ...extra });
	const plan = s => planFocus('c2', s, { start: 10, end: 20, targets: {}, kit });
	assert.deepStrictEqual({
		proofs: [sessions, fake].map(p => kit['list-actions'].proofs(p).map(x => inProof(corpus, x.text))),
		// The row is in at 11.6; the tooltip shows 12-14: the arrow 12.25-14.
		tooltip: plan(spec(sessions, 'tooltip')).focus,
		child: plan(spec(sessions, 'child')).focus,
		// The old c4: a tooltip these params never draw rings nothing: no arrow.
		ringsNothing: plan(spec(fake, 'tooltip')).focusProblem !== null,
		card: plan({ now: { at: 11, rows: [{ id: 'new', text: 'x' }] }, scene: { name: 'card', params: { title: 'x' } }, focus: 'title' }).focusProblem !== null,
		noFocus: plan(spec(sessions, undefined)),
	}, {
		proofs: [[true], [false]],
		tooltip: { name: 'tooltip', row: 'new', from: 12.25, until: 14 },
		child: { name: 'child', row: 'new', from: 14.25, until: 20 },
		ringsNothing: true,
		card: true,
		noFocus: { focus: null, focusProblem: null, camera: [] },
	});
});

test('a recorded focus gets its arrow only while it shows the proof, once still, after the camera settles', () => {
	// A setting row that slides in (0.0-0.3), then stays; it shows the proof only in its second window (5-9 s).
	const track = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 6, 7, 8, 9].map(t => [t, 100, t < 0.3 ? 300 - t * 300 : 210, 300, 60]);
	const mark = { rect: [100, 210, 300, 60], visible: [[0, 1], [5, 9]], texts: ['Font Size', 'Generate images with GPT Image 2.5 Sunburst'], track };
	const recording = { toVideo: c => 20 + c, cEnd: 9, marks: { row: mark } };
	const spec = proof => ({ now: { at: 21, rows: [{ id: 'on', text: 'Image Generation' }] }, focus: 'row', proof });
	const plan = s => planFocus('c2', s, { start: 20, end: 32, targets: { row: {} }, kit: {}, demo: {}, clip: {}, recording });
	assert.deepStrictEqual({
		steady: [steadyFrom(track, 0, 1), steadyFrom(track, 5, 9)],
		withProof: plan(spec('GPT Image 2.5 Sunburst')),
		typedAwayProof: plan(spec('Not shown anywhere')).focusProblem !== null,
	}, {
		steady: [0.6, 5.2],
		// Shown at 25 s in the video, steady at 25.2; the camera zooms in once it is steady (25.1-26.0); the arrow waits
		// until 26.05, and holds to the chapter's end (the window lasts to the recording's end).
		withProof: { focus: { name: 'row', row: 'on', from: 26.05, until: 32 }, focusProblem: null, camera: [{ at: 25.1, dur: 0.9, z: 1.5, fx: 250, fy: 240 }] },
		typedAwayProof: true,
	});
});

test('every icon a chapter uses is found: in rows, heads and scene params', () => {
	assert.deepStrictEqual(iconsOf({
		before: { icon: 'history', rows: [{ id: 'a', icon: 'pin', text: 'Pin' }] },
		now: { rows: [{ id: 'b', style: 'chip', icon: 'github', text: 'Sign in' }, { id: 'c', text: 'No icon' }] },
		visual: { scene: { name: 'list-actions', params: { before: { icon: 'pin' }, after: { icon: 'pulse' }, others: ['check'], rows: [{ label: 'icon' }] } } },
	}), ['history', 'pin', 'github', 'pin', 'pulse', 'check']);
});


test('a drawn setting has VS Code\'s own title, and no invented badge', async () => {
	const kit = await loadSceneDocs();
	assert.deepStrictEqual({
		params: ['title', 'badge'].filter(k => k in kit.setting.params),
		proofs: kit.setting.proofs({ id: 'chat.copilot.ensemble.enabled', title: 'Fusion', description: 'When enabled, Auto is presented as Fusion' }).map(x => x.param),
	}, { params: [], proofs: ['id', 'description'] });
});

test('a recording starts 1.2 s before its focus first shows the proof: how the demo got there is cut', () => {
	const demo = { marks: { row: { visible: [[0.5, 1], [7.03, 11]], texts: ['Commonly Used', 'Enable image generation with GPT Image 2.5 Sunburst'] } } };
	assert.deepStrictEqual([
		focusShows(demo, { focus: 'row', proof: 'GPT Image 2.5 Sunburst' }),
		focusShows(demo, { focus: 'row' }),
		focusShows(demo, { focus: 'missing' }),
	], [5.83, 0, 0]);
});


test('a recorded mark on screen to the recording\'s end keeps its last box through the hold on the last frame', async () => {
	const { trackBoxAt } = await import('../digest/track.js');
	// On screen 7-11.23 s; the last sample is at 10.8 s (the recorder stops sampling a few tenths before the end).
	const mark = { visible: [[7, 11.23]], track: [[7, 1, 2, 3, 4], [10.8, 5, 6, 7, 8]] };
	assert.deepStrictEqual([trackBoxAt(mark, 11.2), trackBoxAt(mark, 6.5), trackBoxAt(mark, 7.1)], [[5, 6, 7, 8], null, [1, 2, 3, 4]]);
});
