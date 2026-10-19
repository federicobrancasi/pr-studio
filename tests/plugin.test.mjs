// The plugin build: the pack holds the engine (and nothing only this repository needs), unpacks to the same bytes, and
// the setup script keeps its copies in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { engineFiles, missingImports, pack } from '../scripts/build-plugin.mjs';
import { copyState, oldCopies, packHash, readPack, stalePartials, stateDir, unpack } from '../plugin/setup.mjs';

function withTemp(fn) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-studio-plugin-'));
	try {
		return fn(dir);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

function write(file, data = '') {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, data);
}

test('a pack unpacks to the same bytes: text whole, pictures in base64, and its hash follows its contents', () => {
	withTemp(dir => {
		const src = path.join(dir, 'src');
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255, 254]);
		write(path.join(src, 'cli', 'prs.mjs'), 'console.log(1);\n==> not/a/header  text 3\n');
		write(path.join(src, 'empty.txt'), '');
		write(path.join(src, 'deck', 'a.png'), png);
		const data = pack(['cli/prs.mjs', 'empty.txt', 'deck/a.png'], { root: src, extra: { 'README.md': 'hi' } });
		const out = path.join(dir, 'out');
		const count = unpack(data, out);
		const changed = pack(['cli/prs.mjs', 'empty.txt', 'deck/a.png'], { root: src, extra: { 'README.md': 'hi!' } });
		assert.deepEqual({
			count,
			names: readPack(data).map(f => f.path),
			same: ['cli/prs.mjs', 'empty.txt', 'deck/a.png', 'README.md'].every(f => fs.readFileSync(path.join(out, f)).equals(f === 'README.md' ? Buffer.from('hi') : fs.readFileSync(path.join(src, f)))),
			hash: packHash(data).length,
			rehash: packHash(changed) !== packHash(data),
		}, { count: 4, names: ['README.md', 'cli/prs.mjs', 'deck/a.png', 'empty.txt'], same: true, hash: 12, rehash: true });
	});
});

test('a missing import is caught; imports in comments and in strings of generated code are not imports', () => {
	withTemp(dir => {
		write(path.join(dir, 'a.mjs'), "// import x from './gone.mjs';\nimport { y } from './b.mjs';\nconst code = \"import z from './template.mjs';\";\nawait import('./lazy.mjs');\n");
		write(path.join(dir, 'b.mjs'), '');
		assert.deepEqual(missingImports(['a.mjs', 'b.mjs'], dir), ['a.mjs imports ./lazy.mjs (lazy.mjs), which is not packed']);
	});
});

test('a pack never writes outside its folder', () => {
	const evil = Buffer.from('==> ../x  text 1\na\n');
	assert.throws(() => readPack(evil), /unsafe path/);
	assert.throws(() => readPack(Buffer.from('==> a  text 5\nab\n')), /cut short/);
});

test('the pack holds the engine, without the tests or what only this repository needs, and nothing it imports is left out', () => {
	const files = engineFiles();
	assert.deepEqual({
		has: ['cli/prs.mjs', 'cli/lib/deck.mjs', 'deck/build.mjs', 'deck/samples/deck.mjs', 'engine/runtime.js', 'package-lock.json', 'voice/voice.py', 'voice/requirements.txt', 'LICENSE', 'NOTICE'].filter(f => !files.includes(f)),
		hasNot: files.filter(f => /^tests\/|\/repo\.mjs$|changelog|triage|prefetch|prompt\.mjs|gallery\.mjs|__pycache__|\/out\//.test(f)),
		missing: missingImports(files),
	}, { has: [], hasNot: [], missing: [] });
});

test('setup: a ready copy is told from a missing or unfinished one; it keeps the newest three, and lives in PRS_HOME', () => {
	withTemp(dir => {
		const copy = path.join(dir, 'engine', 'abc');
		const states = [copyState(copy, 'abc')];
		fs.mkdirSync(copy, { recursive: true });
		states.push(copyState(copy, 'abc'));
		write(path.join(copy, '.setup-ready'), 'other\n');
		states.push(copyState(copy, 'abc'));
		write(path.join(copy, '.setup-ready'), 'abc\n');
		states.push(copyState(copy, 'abc'));
		const root = path.join(dir, 'copies');
		const now = new Date(2026, 9, 20).getTime();
		const day = 24 * 60 * 60 * 1000;
		const at = (file, t) => fs.utimesSync(file, new Date(t), new Date(t));
		['a', 'b', 'c', 'd', 'e', 'f'].forEach((name, i) => {
			write(path.join(root, name, '.setup-ready'), `${name}\n`);
			at(path.join(root, name, '.setup-ready'), now - (10 - i) * day);
		});
		// b's setup is old, but a deck was edited in it an hour ago: another session may still be working there.
		write(path.join(root, 'b', 'decks', 'x', 'deck.mjs'), '');
		at(path.join(root, 'b', 'decks', 'x', 'deck.mjs'), now - 60 * 60 * 1000);
		at(path.join(root, 'b', 'decks', 'x'), now - 5 * day);
		for (const name of ['e.partial-111', 'e.partial-222', 'e.partial-x']) {
			fs.mkdirSync(path.join(root, name));
		}
		assert.deepEqual({
			states,
			old: oldCopies(root, path.join(root, 'a'), 3, now).map(p => path.basename(p)).sort(),
			stale: stalePartials(path.join(root, 'e'), pid => pid === 222).map(p => path.basename(p)),
			home: stateDir({ PRS_HOME: dir }),
			fallback: stateDir({}, '/home/me'),
		}, {
			states: ['missing', 'incomplete', 'incomplete', 'ready'],
			old: ['c', 'd'],
			stale: ['e.partial-111'],
			home: dir,
			fallback: path.join('/home/me', '.cache', 'pr-studio'),
		});
	});
});
