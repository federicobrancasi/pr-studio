// prs concepts: when asked for options, scenes.js exports
//   export const concepts = { beat: 'negotiate', options: { a: exchange.lifelines({...}), b: flow.pipeline({...}), c: ... } };
// This renders the beat's key frame with each option side by side (build/concepts.png) for the user to pick.
import fs from 'node:fs';
import path from 'node:path';
import { buildDir, readJson } from './common.mjs';
import { launch, openVideo } from './browser.mjs';
import { contactSheet } from './stills.mjs';
import { loadScenes, prepare } from './prepare.mjs';

export async function concepts(slug) {
	const { concepts: c } = await loadScenes(slug);
	if (!c?.beat || !c?.options || Object.keys(c.options).length < 2) {
		throw new Error('scenes.js has no concepts: export const concepts = { beat: "<id>", options: { a: ..., b: ..., c: ... } }');
	}
	await prepare(slug, { quiet: true });
	const bdir = buildDir(slug);
	const project = readJson(path.join(bdir, 'project.json'));
	const beat = project.beats.find(b => b.id === c.beat);
	if (!beat) {
		throw new Error(`concepts.beat "${c.beat}" is not a beat`);
	}
	const dir = path.join(bdir, 'concepts');
	fs.mkdirSync(dir, { recursive: true });
	const browser = await launch();
	const images = [];
	try {
		for (const [name, spec] of Object.entries(c.options)) {
			const v = await openVideo(browser, bdir, { search: `?concept=${name}` });
			await v.renderAt(Math.max(beat.start + 0.5, beat.end - 0.4));
			const file = path.join(dir, `${name}.png`);
			await v.page.screenshot({ path: file });
			await v.page.close();
			images.push({ file, label: `${name}: ${spec.treatment}` });
		}
		const out = path.join(bdir, 'concepts.png');
		await contactSheet(browser, dir, images, out, { cols: images.length > 3 ? 2 : images.length, width: images.length > 3 ? 900 : 620 });
		console.log(`concepts for "${c.beat}": ${out}`);
		console.log(`narration: ${beat.words.map(w => w.display).join(' ')}`);
	} finally {
		await browser.close();
	}
}
