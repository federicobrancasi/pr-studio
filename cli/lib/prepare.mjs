// prs prepare: storyboard + timeline (real or provisional) + PR facts + scenes.js -> build/project.json + build/bundle.js
// Every text and code reference in scenes.js is verified against the PR here, before anything renders.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { ROOT, buildDir, readJson, sha256, sha256File, storyboardVoiceHash, videoDir, voicePace, writeJson } from './common.mjs';
import { estimateTimeline } from './timeline.mjs';
import { parseDiff, resolveCode, fileAtHead } from './code.mjs';
import { checkEvidence, stripMarkdown } from './evidence.mjs';
import { codeKey, getPath, walkRefs } from '../../engine/text.js';

const norm = s => String(s).replace(/\s+/g, ' ').trim();

/** Bundles scenes.js for Node and imports it (SVG icons load as text; no DOM is touched at import time). */
export async function loadScenes(slug, file = 'scenes.js') {
	const out = path.join(buildDir(slug), `.${path.basename(file, '.js')}.node.mjs`);
	await esbuild.build({
		entryPoints: [path.join(videoDir(slug), file)], bundle: true, platform: 'node', format: 'esm', outfile: out,
		loader: { '.svg': 'text', '.css': 'empty' }, logLevel: 'silent', absWorkingDir: ROOT,
	});
	const mod = await import(`${pathToFileURL(out).href}?v=${Date.now()}`);
	const video = mod.default;
	if (!video?.$video) {
		throw new Error(`${file} must "export default defineVideo({ ... })"`);
	}
	return { video, concepts: mod.concepts ?? null };
}

export function prCorpus(slug, pr) {
	const diff = fs.readFileSync(path.join(videoDir(slug), 'pr.diff'), 'utf8');
	const diffText = diff.split('\n').filter(l => /^[+\- ]/.test(l) && !/^(\+\+\+|---) /.test(l)).map(l => l.slice(1)).join('\n');
	const f = pr.facts;
	return {
		diff,
		quote: norm([f.title, pr.body ?? '', stripMarkdown(pr.body ?? ''), ...(f.commits ?? []).map(c => c.message ?? c.headline), diffText, ...(f.linkedIssues ?? []).map(i => i.title), ...(pr.tests ?? []).flatMap(t => t.names), ...(pr.discussion ?? []).flatMap(d => [d.body, stripMarkdown(d.body)])].join('\n')),
		idents: [diffText, f.files.map(x => x.path).join('\n'), pr.body ?? ''].join('\n'),
		paths: f.files.map(x => x.path),
	};
}

function verifyText(ref, corpus, facts, codeTexts) {
	if (/\bTODO\b/.test(ref.text ?? '')) {
		return { error: `still a TODO: "${ref.text}"` };
	}
	switch (ref.$text) {
		case 'label':
			return /\d{3,}/.test(ref.text) ? `label "${ref.text}" contains a number: if it comes from the PR, use fact() or quote()` : null;
		case 'fact':
			return getPath(facts, ref.path) === undefined ? `fact('${ref.path}') is not in pr.json facts` : false;
		case 'quote':
			return corpus.quote.includes(norm(ref.text)) ? false : `quote("${ref.text}") is not in the PR (title, body, commits, diff, tests or review discussion). Quote exactly or use label()`;
		case 'ident': {
			const bare = ref.text.replace(/\(\)$/, '').replace(/^[.#@]/, '');
			if (corpus.idents.includes(bare) || codeTexts.some(t => t.includes(bare)) || corpus.inChangedFiles(bare)) {
				return false;
			}
			return `ident("${ref.text}") is not in the PR's diff or its changed files at the head commit`;
		}
		case 'path': {
			const ok = corpus.paths.some(p => p === ref.path || p.includes(`${ref.path}/`) || p.endsWith(`/${ref.path}`) || p.includes(`/${ref.path}/`) || p.startsWith(`${ref.path}/`));
			return ok ? false : `path("${ref.path}") is not a file (or folder) changed by this PR`;
		}
		default:
			return `unknown text kind ${ref.$text}`;
	}
}

export async function prepare(slug, { quiet = false } = {}) {
	const vdir = videoDir(slug), bdir = buildDir(slug);
	fs.mkdirSync(bdir, { recursive: true });
	const pr = readJson(path.join(vdir, 'pr.json'));
	const storyboard = readJson(path.join(vdir, 'storyboard.json'));
	const facts = pr.facts;
	const real = fs.existsSync(path.join(bdir, 'timeline.json'));
	const timeline = real ? readJson(path.join(bdir, 'timeline.json')) : estimateTimeline(storyboard, facts, { pace: voicePace() });
	if (real) {
		const voiced = readJson(path.join(bdir, 'voice.json'));
		if (voiced.storyboard !== storyboardVoiceHash(storyboard)) {
			throw new Error('storyboard.json changed after the voice was made. Run: prs voice (or delete build/timeline.json to use provisional timing)');
		}
	}
	const { video, concepts } = await loadScenes(slug);
	const ids = storyboard.beats.map(b => b.id);
	const sceneIds = Object.keys(video.beats);
	const missing = ids.filter(id => !sceneIds.includes(id));
	const extra = sceneIds.filter(id => !ids.includes(id));
	if (missing.length || extra.length) {
		throw new Error(`scenes.js and storyboard.json disagree. ${missing.length ? `Missing in scenes.js: ${missing.join(', ')}. ` : ''}${extra.length ? `Not in the storyboard: ${extra.join(', ')}.` : ''}`);
	}
	if (video.beats[ids[0]].treatment !== 'title.frame') {
		throw new Error(`The first beat ("${ids[0]}") must use title.frame`);
	}

	// Collect and verify every reference.
	const corpus = prCorpus(slug, pr);
	// Names that aren't in the diff may still be in the changed files (a class whose method changed): look there last.
	let changedTexts = null;
	corpus.inChangedFiles = name => {
		changedTexts ??= facts.files.filter(f => f.status !== 'removed').map(f => {
			try {
				return fileAtHead(slug, facts, f.path);
			} catch {
				return '';
			}
		});
		return changedTexts.some(t => t.includes(name));
	};
	const diffFiles = parseDiff(corpus.diff);
	const problems = [], warnings = [];
	const codeRefs = new Map();
	const textRefs = [];
	const allSpecs = { ...video.beats };
	for (const [name, spec] of Object.entries(concepts?.options ?? {})) {
		allSpecs[`concept:${name}`] = spec;
	}
	for (const [id, spec] of Object.entries(allSpecs)) {
		for (const { ref, trail } of walkRefs(spec.params)) {
			if (ref.$code) {
				codeRefs.set(codeKey(ref), { ref, where: `${id}.${trail}` });
			} else {
				textRefs.push({ ref, where: `${id}.${trail}` });
			}
		}
	}
	if (video.carry) {
		for (const { ref, trail } of walkRefs(video.carry)) {
			textRefs.push({ ref, where: `carry.${trail}` });
		}
	}
	const code = {};
	for (const [key, { ref, where }] of codeRefs) {
		try {
			code[key] = await resolveCode(slug, facts, diffFiles, ref);
		} catch (error) {
			problems.push(`${where}: ${error.message}`);
		}
	}
	const codeTexts = Object.values(code).map(b => b.lines.map(l => l.text).join('\n'));
	for (const { ref, where } of textRefs) {
		const issue = verifyText(ref, corpus, facts, codeTexts);
		if (issue?.error) {
			problems.push(`${where}: ${issue.error}`);
		} else if (issue && ref.$text === 'label') {
			warnings.push(`${where}: ${issue}`);
		} else if (issue) {
			problems.push(`${where}: ${issue}`);
		}
	}
	// Every claim's evidence must hold against the PR.
	for (const beat of storyboard.beats) {
		for (const claim of beat.claims ?? []) {
			for (const ev of claim.evidence ?? []) {
				const issue = checkEvidence(slug, pr, ev);
				if (issue) {
					problems.push(`storyboard ${beat.id}: ${issue}`);
				}
			}
		}
	}
	if (problems.length) {
		throw new Error(`prepare found ${problems.length} problem${problems.length > 1 ? 's' : ''}:\n  - ${problems.join('\n  - ')}`);
	}

	// Timing of the whole video: the end card follows the last word; then a 3.4 s hold.
	const beats = storyboard.beats.map((sb, k) => {
		const tb = timeline.beats.find(b => b.id === sb.id);
		if (!tb) {
			throw new Error(`Beat "${sb.id}" is missing from the timeline; run prs voice`);
		}
		return { id: sb.id, need: sb.need, start: k === 0 ? 0 : tb.start, end: tb.end, words: tb.words, cues: tb.cues };
	});
	const lastWord = beats.at(-1).words.at(-1).b;
	const endAt = +(lastWord + 0.45).toFixed(3);
	const total = +Math.max(timeline.total, endAt + 3.4).toFixed(3);
	const project = {
		id: slug, estimated: !real,
		pr: { facts },
		video: { fps: 30, endAt, total, motion: video.motion },
		beats, code,
	};
	writeJson(path.join(bdir, 'project.json'), project);
	await bundle(slug);
	const lock = {
		project: sha256File(path.join(bdir, 'project.json')),
		bundle: sha256(fs.readFileSync(path.join(bdir, 'bundle.js')) + fs.readFileSync(path.join(bdir, 'bundle.css'))),
		timeline: real ? sha256File(path.join(bdir, 'timeline.json')) : null,
		narration: real && fs.existsSync(path.join(bdir, 'narration.wav')) ? sha256File(path.join(bdir, 'narration.wav')) : null,
	};
	writeJson(path.join(bdir, 'build.lock.json'), lock);
	if (!quiet) {
		console.log(`prepared ${slug}: ${beats.length} beats, ${total.toFixed(1)} s${real ? '' : ' (provisional timing: run prs voice for the real one)'}, ${Object.keys(code).length} code blocks, ${textRefs.length} text references verified`);
		for (const w of warnings) {
			console.log(`  warning: ${w}`);
		}
	}
	return { project, video, warnings, lock };
}

export async function bundle(slug, { entry = null } = {}) {
	const bdir = buildDir(slug);
	const entryFile = path.join(bdir, 'entry.js');
	const rel = p => path.relative(bdir, p).split(path.sep).join('/');
	fs.writeFileSync(entryFile, entry ?? [
		`import video, * as scenes from '${rel(path.join(videoDir(slug), 'scenes.js'))}';`,
		"import project from './project.json';",
		`import { start } from '${rel(path.join(ROOT, 'engine', 'runtime.js'))}';`,
		'const concept = new URLSearchParams(location.search).get(\'concept\');',
		'const chosen = concept && scenes.concepts ? { ...video, beats: { ...video.beats, [scenes.concepts.beat]: scenes.concepts.options[concept] } } : video;',
		'start(chosen, project).catch(error => console.error(error && error.stack || String(error)));',
		'',
	].join('\n'));
	await esbuild.build({
		entryPoints: { bundle: entryFile }, bundle: true, format: 'iife', platform: 'browser', outdir: bdir,
		loader: { '.svg': 'text', '.json': 'json', '.woff2': 'file' }, external: ['file:*'], assetNames: 'assets/[name]-[hash]',
		logLevel: 'silent', absWorkingDir: ROOT, target: 'chrome120',
	});
	fs.writeFileSync(path.join(bdir, 'index.html'), '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="bundle.css"></head>\n<body><div id="app"></div><script src="bundle.js"></script></body></html>\n');
}
