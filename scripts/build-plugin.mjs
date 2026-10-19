#!/usr/bin/env node
// npm run plugin -- <plugin folder> [--no-images]: builds the pr-studio plugin of the VS Code team kit from this
// repository. It writes the plugin's
//   scripts/engine.pack                   every file of the engine, whole (the skills' setup script unpacks it)
//   scripts/setup.mjs                     from plugin/setup.mjs
//   skills/generate-video/catalog.png     every diagram treatment on one numbered picture, with catalog.md
//   skills/generate-presentation/samples.png   every slide layout on one picture
// The skills' own text (SKILL.md, the guides) is written in the plugin, not here.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Folders and files of the engine. */
const INCLUDE = ['cli/', 'engine/', 'theme/', 'catalog/', 'deck/', 'voice/', 'package.json', 'package-lock.json', 'LICENSE', 'NOTICE'];
/** What only this repository needs: Slack requests, the #changelog videos and digest, the README gallery. */
const REPO_ONLY = ['cli/repo.mjs', 'cli/lib/changelog.mjs', 'cli/lib/digest.mjs', 'cli/lib/demo.mjs', 'cli/lib/triage.mjs', 'cli/lib/prefetch.mjs', 'cli/lib/prompt.mjs', 'cli/lib/gallery.mjs'];
/** Loaded only in the repository, after checking it is there: may be missing from the pack. */
const OPTIONAL = new Set(['cli/repo.mjs', 'cli/lib/gallery.mjs']);
const SKIP_PARTS = new Set(['__pycache__', 'out', '.DS_Store']);

/** The engine's files, relative paths with '/': what git knows of (tracked or new, not ignored), minus the rest. */
export function engineFiles(root = ROOT) {
	const listed = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
	return listed
		.filter(f => INCLUDE.some(p => (p.endsWith('/') ? f.startsWith(p) : f === p)))
		.filter(f => !REPO_ONLY.includes(f) && !f.split('/').some(part => SKIP_PARTS.has(part)) && !/\.test\.mjs$/.test(f))
		.filter(f => fs.existsSync(path.join(root, f)))
		.sort();
}

/** Relative imports of the packed JavaScript that point outside the pack (a static one would break the plugin). */
export function missingImports(files, root = ROOT) {
	const set = new Set(files);
	const problems = [];
	for (const f of files.filter(x => /\.(m?js)$/.test(x))) {
		// Real imports only: a line that starts an import (not one inside a comment or a string of generated code), and
		// import() calls in code.
		const text = fs.readFileSync(path.join(root, f), 'utf8');
		const refs = [
			...[...text.matchAll(/^import\s(?:[^'"\n]*?\sfrom\s)?(['"])(\.{1,2}\/[^'"]+)\1/gm)].map(m => m[2]),
			...text.split('\n').filter(line => !/^\s*(\/\/|\*)/.test(line) && !/^\s*['"`]/.test(line)).flatMap(line => [...line.matchAll(/\bimport\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g)].map(m => m[2])),
		];
		for (const ref of refs) {
			const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), ref));
			if (!set.has(target) && !OPTIONAL.has(target)) {
				problems.push(`${f} imports ${ref} (${target}), which is not packed`);
			}
		}
	}
	return problems;
}

/** A file is stored as text when it is valid UTF-8 without NUL bytes; else in base64, wrapped. */
function entry(rel, data) {
	const text = data.toString('utf8');
	if (!data.includes(0) && Buffer.from(text, 'utf8').equals(data)) {
		return Buffer.concat([Buffer.from(`==> ${rel}  text ${data.length}\n`), data, Buffer.from('\n')]);
	}
	const b64 = data.toString('base64').replace(/.{1,100}/g, '$&\n').replace(/\n$/, '');
	return Buffer.from(`==> ${rel}  base64 ${Buffer.byteLength(b64)}\n${b64}\n`);
}

/** The pack: a short header, then every file whole. `extra` adds or replaces files: { 'README.md': Buffer }. */
export function pack(files, { root = ROOT, extra = {} } = {}) {
	const all = new Map(files.map(f => [f, fs.readFileSync(path.join(root, f))]));
	for (const [rel, data] of Object.entries(extra)) {
		all.set(rel, Buffer.isBuffer(data) ? data : Buffer.from(data));
	}
	const names = [...all.keys()].sort();
	const head = [
		'# The pr-studio engine: every file the pr-studio plugin needs, whole, from https://github.com/federicobrancasi/pr-studio',
		'# (MIT: see LICENSE and NOTICE below). Made by `npm run plugin` there: change the source and repack, never this file.',
		'# scripts/setup.mjs unpacks it into ~/.cache/pr-studio/engine/<hash>/ and installs its npm packages.',
		`# ${names.length} files. Each one: a line "==> <path>  <text|base64> <bytes>", that many bytes, and a newline.`,
		'',
	].join('\n');
	return Buffer.concat([Buffer.from(head + '\n'), ...names.map(n => entry(n, all.get(n)))]);
}

/** package.json for the packed engine: its packages, without this repository's scripts. */
function enginePackageJson() {
	const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
	const { scripts, ...rest } = pkg;
	return JSON.stringify({ ...rest, description: 'The engine of the pr-studio plugin: explainer videos of pull requests and slide decks in one white Microsoft look.', scripts: { prs: scripts?.prs ?? 'node cli/prs.mjs' } }, null, 2) + '\n';
}

function prs(args) {
	execFileSync(process.execPath, [path.join(ROOT, 'cli', 'prs.mjs'), ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
}

/** The layout samples' contact sheet, scaled to `width` pixels (drawn by the browser: no image tools needed). */
async function samplesPicture(out, width = 1345) {
	prs(['deck', 'samples', '--no-pdf']);
	const sheet = path.join(ROOT, 'deck', 'samples', 'out', 'contact.png');
	const html = path.join(path.dirname(sheet), '.scaled.html');
	fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>body{margin:0}img{display:block;width:${width}px}</style><img src="${pathToFileURL(sheet).href}">`);
	const { launch } = await import(pathToFileURL(path.join(ROOT, 'cli', 'lib', 'browser.mjs')).href);
	const browser = await launch();
	try {
		const page = await browser.newPage({ viewport: { width, height: 800 } });
		await page.goto(pathToFileURL(html).href);
		const loaded = await page.evaluate(async () => {
			const img = document.images[0];
			await img.decode().catch(() => null);
			return img.naturalWidth > 0;
		});
		if (!loaded) {
			throw new Error(`samples.png: could not load ${sheet}`);
		}
		await page.locator('img').screenshot({ path: out });
	} finally {
		await browser.close();
		fs.rmSync(html, { force: true });
	}
}

async function main() {
	const args = process.argv.slice(2);
	const target = args.find(a => !a.startsWith('--'));
	if (!target) {
		console.error('Usage: npm run plugin -- <the plugin folder, e.g. ../vscode-team-kit/pr-studio> [--no-images]');
		process.exit(2);
	}
	const plugin = path.resolve(target);
	if (!fs.existsSync(path.join(plugin, '.plugin', 'plugin.json'))) {
		throw new Error(`${plugin} is not the plugin (no .plugin/plugin.json)`);
	}
	const files = engineFiles();
	const problems = missingImports(files);
	if (problems.length) {
		throw new Error(`The pack would be broken:\n  ${problems.join('\n  ')}`);
	}
	const data = pack(files, { extra: { 'README.md': fs.readFileSync(path.join(ROOT, 'plugin', 'ENGINE.md')), 'package.json': enginePackageJson() } });
	fs.mkdirSync(path.join(plugin, 'scripts'), { recursive: true });
	fs.writeFileSync(path.join(plugin, 'scripts', 'engine.pack'), data);
	fs.copyFileSync(path.join(ROOT, 'plugin', 'setup.mjs'), path.join(plugin, 'scripts', 'setup.mjs'));
	console.log(`scripts/engine.pack: ${files.length + 1} files, ${(data.length / 1024).toFixed(0)} KB; scripts/setup.mjs`);
	if (!args.includes('--no-images')) {
		const video = path.join(plugin, 'skills', 'generate-video');
		prs(['catalog', '--sheet', path.join(video, 'catalog.png')]);
		console.log('skills/generate-video/catalog.png and catalog.md');
		await samplesPicture(path.join(plugin, 'skills', 'generate-presentation', 'samples.png'));
		console.log('skills/generate-presentation/samples.png');
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(error => {
		console.error(error.message);
		process.exit(1);
	});
}
