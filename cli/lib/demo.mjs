// prs demo <slug> <id>: records a demo of VS Code for a changelog digest. Runs videos/<slug>/demos/<id>.mjs against a
// VS Code build in a throwaway profile, records the window, and logs where the UI the script marks is and when it is
// on screen, so the video's arrows land on it exactly.
//
// The demo script (an ES module):
//   export const files = { 'README.md': '# My project\n' };   // the workspace (optional)
//   export const settings = { 'editor.minimap.enabled': false };  // user settings (optional)
//   export async function setup({ page, run, ... }) { ... }   // before recording starts (optional)
//   export default async function demo({ page, run, mark, step, moveTo, click, type, press, sleep, openUrl }) { ... }
// mark(name, locator, { text }) logs that element's box (or the box of a text inside it) and the times it is shown:
// marks are followed for the whole recording, so give each one a locator that matches only its UI (filter by its
// text); step(label) logs a moment worth a still.
//
// The build: PRS_VSCODE (the executable: code-insiders on Linux), or on macOS /Applications/Visual Studio Code -
// Insiders.app. Signed out on Linux (CI: no keychain); on macOS always signed in, with a copy of the signed-in Insiders
// profile and the login keychain (a signed-out window there asks for the keychain and starts without the account).
// Writes videos/<slug>/build/demos/<id>/: frames/ (30 fps, 2560x1440), demo.json, clip.mp4, contact.png.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { _electron } from 'playwright-core';
import { buildDir, findFfmpeg, videoDir, writeJson } from './common.mjs';
import { launch } from './browser.mjs';

const SIZE = { width: 1280, height: 720 };
const FPS = 30;
const MAC_INSIDERS = '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Code - Insiders';
const MAC_STATE = path.join(os.homedir(), 'Library/Application Support/Code - Insiders/User/globalStorage/state.vscdb');

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function vscodePath() {
	const p = process.env.PRS_VSCODE || (process.platform === 'darwin' ? MAC_INSIDERS : null);
	if (!p || !fs.existsSync(p)) {
		throw new Error(`No VS Code build: set PRS_VSCODE to its executable (${p ? `${p} does not exist` : 'code-insiders on Linux'})`);
	}
	return p;
}

/** The build's version and commit, from its product.json and package.json. */
export function buildInfo(exe = vscodePath()) {
	const roots = process.platform === 'darwin'
		? [path.join(exe, '../../Resources/app')]
		: [path.join(path.dirname(exe), 'resources/app'), path.join(path.dirname(exe), '../resources/app')];
	for (const root of roots) {
		if (fs.existsSync(path.join(root, 'product.json'))) {
			const product = JSON.parse(fs.readFileSync(path.join(root, 'product.json'), 'utf8'));
			const pkg = fs.existsSync(path.join(root, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) : {};
			return { name: product.nameLong ?? product.nameShort, quality: product.quality, version: pkg.version ?? null, commit: product.commit ?? null };
		}
	}
	return { name: 'VS Code', quality: null, version: null, commit: null };
}

/** An X server for Linux runs without a display (CI): Xvfb on a free display number. */
async function ensureDisplay() {
	if (process.platform !== 'linux' || process.env.DISPLAY) {
		return null;
	}
	for (let n = 90; n < 110; n++) {
		if (fs.existsSync(`/tmp/.X11-unix/X${n}`) || fs.existsSync(`/tmp/.X${n}-lock`)) {
			continue;
		}
		const xvfb = spawn('Xvfb', [`:${n}`, '-screen', '0', '2600x1500x24', '-nolisten', 'tcp'], { stdio: 'ignore' });
		for (let i = 0; i < 50 && !fs.existsSync(`/tmp/.X11-unix/X${n}`); i++) {
			await sleep(100);
		}
		if (!fs.existsSync(`/tmp/.X11-unix/X${n}`)) {
			xvfb.kill();
			throw new Error('Xvfb did not start (is it installed?)');
		}
		return { display: `:${n}`, stop: () => xvfb.kill() };
	}
	throw new Error('No free X display');
}

/** Opens VS Code on a workspace in a throwaway profile; close() deletes it (also on Ctrl+C and errors). */
export async function openVSCode({ files = {}, settings = {}, signedIn = process.platform === 'darwin', log = console.log } = {}) {
	const exe = vscodePath();
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prs-demo-'));
	let app, xserver;
	const cleanup = () => {
		try {
			app?.process()?.kill();
		} catch { }
		xserver?.stop();
		fs.rmSync(tmp, { recursive: true, force: true });
	};
	const onSignal = () => {
		cleanup();
		process.exit(130);
	};
	process.once('SIGINT', onSignal);
	process.once('SIGTERM', onSignal);
	try {
		const home = path.join(tmp, 'home');
		const data = path.join(tmp, 'user-data');
		const workspace = path.join(tmp, 'my-project');
		fs.mkdirSync(path.join(data, 'User/globalStorage'), { recursive: true });
		fs.mkdirSync(home, { recursive: true });
		const env = { ...process.env, HOME: home };
		if (process.platform === 'darwin') {
			// Its own HOME, with the login keychain linked in: without it macOS asks for a keychain.
			fs.mkdirSync(path.join(home, 'Library'), { recursive: true });
			fs.symlinkSync(path.join(os.homedir(), 'Library/Keychains'), path.join(home, 'Library/Keychains'));
		}
		if (signedIn) {
			if (process.platform !== 'darwin' || !fs.existsSync(MAC_STATE)) {
				throw new Error('--signed-in needs a signed-in VS Code Insiders profile on this Mac');
			}
			const copy = path.join(data, 'User/globalStorage/state.vscdb');
			execFileSync('sqlite3', [MAC_STATE, `.backup "${copy}"`]);
			// A clean demo: none of the recent folders or recently used commands.
			execFileSync('sqlite3', [copy, 'DELETE FROM ItemTable WHERE key IN (\'history.recentlyOpenedPathsList\', \'commandPalette.mru.cache\', \'commandPalette.mru.counter\')']);
		}
		writeJson(path.join(data, 'User/settings.json'), {
			'window.dialogStyle': 'custom',
			'window.restoreWindows': 'none',
			'update.mode': 'none',
			'telemetry.telemetryLevel': 'off',
			'workbench.tips.enabled': false,
			'extensions.autoCheckUpdates': false,
			'extensions.autoUpdate': false,
			...settings,
		});
		for (const [name, content] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(workspace, name)), { recursive: true });
			fs.writeFileSync(path.join(workspace, name), content);
		}
		fs.mkdirSync(workspace, { recursive: true });
		const args = [
			`--user-data-dir=${data}`, `--extensions-dir=${path.join(tmp, 'extensions')}`,
			'--skip-release-notes', '--disable-telemetry', '--disable-experiments', '--no-cached-data',
			'--disable-updates', '--disable-workspace-trust', '--new-window', workspace,
		];
		if (process.platform === 'linux') {
			xserver = await ensureDisplay();
			if (xserver) {
				env.DISPLAY = xserver.display;
			}
			args.unshift('--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--password-store=basic', '--force-device-scale-factor=2');
		}
		app = await _electron.launch({ executablePath: exe, args, env, timeout: 90_000 });
		const page = await app.firstWindow();
		await app.evaluate(({ BrowserWindow }, s) => {
			const w = BrowserWindow.getAllWindows()[0];
			w.setPosition(40, 40);
			w.setContentSize(s.width, s.height);
		}, SIZE);
		await page.waitForSelector('.monaco-workbench', { timeout: 90_000 });
		log(`VS Code up (${signedIn ? 'signed in: a copy of the local profile' : 'signed out'})`);
		return {
			app, page, workspace,
			async close() {
				await app.close().catch(() => { });
				cleanup();
				process.off('SIGINT', onSignal);
				process.off('SIGTERM', onSignal);
			},
		};
	} catch (error) {
		cleanup();
		process.off('SIGINT', onSignal);
		process.off('SIGTERM', onSignal);
		throw error;
	}
}

/** A new user's first run (signed out): skip the sign-in screen and the theme page. */
export async function skipOnboarding(page) {
	const overlay = page.locator('.onboarding-a-overlay.visible');
	if (!await overlay.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false)) {
		return false;
	}
	for (const name of ['Continue without Signing In', 'Get Started']) {
		const button = overlay.getByRole('button', { name });
		if (await button.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false)) {
			await sleep(400);
			await button.click();
		}
	}
	await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });
	await sleep(600);
	return true;
}

/** A visible arrow cursor that follows the mouse (the screencast has no OS cursor). */
async function showCursor(page) {
	await page.evaluate(() => {
		if (document.getElementById('prs-cursor')) {
			return;
		}
		const ns = 'http://www.w3.org/2000/svg';
		const cursor = document.createElement('div');
		cursor.id = 'prs-cursor';
		cursor.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);';
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('width', '26');
		svg.setAttribute('height', '26');
		svg.setAttribute('viewBox', '0 0 24 24');
		const arrow = document.createElementNS(ns, 'path');
		arrow.setAttribute('d', 'M4 2.5l13.5 12.2-6.2.6 3.7 7.3-2.6 1.3-3.6-7.4-4.8 4.1z');
		arrow.setAttribute('fill', '#fff');
		arrow.setAttribute('stroke', '#111');
		arrow.setAttribute('stroke-width', '1.4');
		arrow.setAttribute('stroke-linejoin', 'round');
		svg.appendChild(arrow);
		cursor.appendChild(svg);
		document.body.appendChild(cursor);
		document.addEventListener('mousemove', e => {
			cursor.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`;
		}, true);
	});
}

/** The helpers a demo script gets. */
function helpers(page, app) {
	const moveTo = async (locator, steps = 28) => {
		const box = await locator.boundingBox({ timeout: 10_000 });
		if (!box) {
			throw new Error(`Nothing to move to: ${locator}`);
		}
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
	};
	const run = async (command, { delay = 18 } = {}) => {
		await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+P' : 'Control+Shift+P');
		await page.locator('.quick-input-widget').waitFor({ state: 'visible', timeout: 10_000 });
		await sleep(250);
		await page.keyboard.type(command, { delay });
		await sleep(450);
		await page.keyboard.press('Enter');
	};
	return {
		page, app, sleep,
		moveTo,
		/** Moves the mouse to it, then clicks (a real click, as a user would). */
		async click(locator, { pause = 300 } = {}) {
			await moveTo(locator);
			await sleep(pause);
			const box = await locator.boundingBox();
			await page.mouse.down();
			await page.mouse.up();
			return box;
		},
		/** Runs a command from the Command Palette, typed as a user would. */
		run,
		/** Opens a vscode:// (or vscode-insiders://) link inside this window (Developer: Open URL), pasted. */
		async openUrl(url) {
			await run('Developer: Open URL');
			await page.locator('.quick-input-widget input').first().waitFor({ state: 'visible', timeout: 10_000 });
			await page.keyboard.insertText(url);
			await sleep(700);
			await page.keyboard.press('Enter');
		},
		async type(text, { delay = 45 } = {}) {
			await page.keyboard.type(text, { delay });
		},
		async press(key) {
			await page.keyboard.press(key);
		},
		/** The product's own URL scheme: vscode-insiders for Insiders. */
		scheme: null,
	};
}

/** Every repaint of the window as a JPEG at device resolution, with its time; stop() returns the frames. */
async function screencast(page, dir) {
	const frames = [];
	const cdp = await page.context().newCDPSession(page);
	cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
		const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
		fs.writeFileSync(file, Buffer.from(data, 'base64'));
		frames.push({ file, t: metadata.timestamp });
		cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => { });
	});
	await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: SIZE.width * 2, maxHeight: SIZE.height * 2, everyNthFrame: 1 });
	return {
		frames,
		async stop() {
			await cdp.send('Page.stopScreencast').catch(() => { });
			await sleep(200);
			return frames;
		},
	};
}

/** The box of the first shown element of a locator's matches (or of a text inside it), in the page; null if none. */
function measure(elements, text) {
	for (const el of elements) {
		if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
			continue;
		}
		let r = el.getBoundingClientRect();
		if (text) {
			// The words themselves (a sentence of a paragraph): a range over the text nodes that hold them.
			const nodes = [];
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			let all = '';
			while (walker.nextNode()) {
				nodes.push({ node: walker.currentNode, from: all.length });
				all += walker.currentNode.data;
			}
			const at = all.indexOf(text);
			if (at < 0) {
				continue;
			}
			const find = i => {
				const n = nodes.findLast(x => x.from <= i);
				return [n.node, i - n.from];
			};
			const range = document.createRange();
			range.setStart(...find(at));
			range.setEnd(...find(at + text.length - 1));
			range.setEnd(range.endContainer, range.endOffset + 1);
			r = range.getBoundingClientRect();
		}
		if (r.width > 0 && r.height > 0) {
			return { x: r.x, y: r.y, width: r.width, height: r.height };
		}
	}
	return null;
}

/** Logs each marked element's box and visibility every 100 ms while recording. */
function markTracker(page) {
	const marks = new Map();
	let running = true;
	const sample = async () => {
		while (running) {
			const now = Date.now() / 1000;
			for (const m of marks.values()) {
				// evaluateAll does not wait for a match: a mark that is not on screen costs nothing.
				const box = await m.locator.evaluateAll(measure, m.text).catch(() => null);
				m.samples.push({ t: now, box });
			}
			await sleep(100);
		}
	};
	const loop = sample();
	return {
		mark(name, locator, { text = null } = {}) {
			if (!/^[a-zA-Z][\w.-]*$/.test(name)) {
				throw new Error(`mark(): "${name}" is not a valid name (letters, digits, ., - and _)`);
			}
			marks.set(name, { locator, text, samples: marks.get(name)?.samples ?? [] });
		},
		async stop() {
			running = false;
			await loop;
			return marks;
		},
	};
}

/** Visible windows (clip seconds) and a representative box (the middle of the longest window), per mark. */
function summarizeMarks(marks, t0, duration) {
	const out = {};
	for (const [name, m] of marks) {
		const windows = [];
		let open = null;
		for (const s of m.samples) {
			const t = +(s.t - t0).toFixed(2);
			if (s.box && !open) {
				open = { from: t, boxes: [] };
			}
			if (s.box) {
				open.boxes.push(s.box);
			}
			if (!s.box && open) {
				windows.push({ ...open, to: t });
				open = null;
			}
		}
		if (open) {
			windows.push({ ...open, to: +duration.toFixed(2) });
		}
		const kept = windows.filter(w => w.to > Math.max(0, w.from));
		if (!kept.length) {
			out[name] = { rect: null, visible: [] };
			continue;
		}
		const longest = kept.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
		const box = longest.boxes[Math.floor(longest.boxes.length / 2)];
		out[name] = {
			rect: [box.x, box.y, box.width, box.height].map(v => +v.toFixed(1)),
			visible: kept.map(w => [Math.max(0, w.from), Math.min(duration, w.to)].map(v => +v.toFixed(2))),
		};
	}
	return out;
}

/** A contact sheet of the recording: stills at its steps and every few seconds, with the marks drawn on them. */
async function demoContact(dir, info, out) {
	const times = [...new Set([...info.steps.map(s => s.t), ...Array.from({ length: 9 }, (_, i) => info.duration * (i + 0.5) / 9)].map(t => +Math.min(info.duration - 0.05, Math.max(0, t)).toFixed(2)))].sort((a, b) => a - b).slice(0, 15);
	const colors = ['#e81123', '#0078d4', '#107c10', '#d83b01', '#8661c5', '#00b7c3', '#ffb900'];
	const names = Object.keys(info.marks);
	const cells = times.map(t => {
		const frame = path.join(dir, 'frames', `${String(Math.min(info.count, Math.floor(t * FPS) + 1)).padStart(5, '0')}.jpg`);
		const step = info.steps.filter(s => Math.abs(s.t - t) < 0.01).map(s => s.label).join(', ');
		const boxes = names.map((n, i) => {
			const m = info.marks[n];
			if (!m.rect || !m.visible.some(([a, b]) => t >= a && t < b)) {
				return '';
			}
			const [x, y, w, h] = m.rect.map(v => v / 2);
			return `<div class="b" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${colors[i % colors.length]}"><span style="background:${colors[i % colors.length]}">${n}</span></div>`;
		}).join('');
		return `<figure><div class="f"><img src="${pathToFileURL(frame).href}">${boxes}</div><figcaption>${t.toFixed(2)} s${step ? ` · ${step.replace(/</g, '&lt;')}` : ''}</figcaption></figure>`;
	});
	const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e9ecf1;font:600 14px -apple-system,Segoe UI,sans-serif}main{display:grid;grid-template-columns:repeat(3,640px);gap:12px;padding:12px}figure{margin:0}.f{position:relative;width:640px;height:360px}.f img{width:640px;height:360px;display:block}.b{position:absolute;border:2px solid;box-sizing:border-box}.b span{position:absolute;left:-2px;top:-18px;color:#fff;font-size:11px;padding:1px 4px;white-space:nowrap}figcaption{padding:4px 2px}</style><main>${cells.join('')}</main>`;
	const file = path.join(dir, '.contact.html');
	fs.writeFileSync(file, html);
	const browser = await launch();
	try {
		const page = await browser.newPage({ viewport: { width: 3 * 652 + 12, height: 400 }, deviceScaleFactor: 1 });
		await page.goto(pathToFileURL(file).href);
		await page.screenshot({ path: out, fullPage: true });
	} finally {
		await browser.close();
		fs.rmSync(file, { force: true });
	}
}

export async function demo(slug, id, { signedIn = process.platform === 'darwin' } = {}) {
	const script = path.join(videoDir(slug), 'demos', `${id}.mjs`);
	if (!fs.existsSync(script)) {
		throw new Error(`No demo script: ${script}`);
	}
	const mod = await import(`${pathToFileURL(script).href}?v=${Date.now()}`);
	if (typeof mod.default !== 'function') {
		throw new Error(`${script} must export default async function demo(ctx)`);
	}
	const out = path.join(buildDir(slug), 'demos', id);
	fs.rmSync(out, { recursive: true, force: true });
	const raw = path.join(out, 'raw');
	fs.mkdirSync(raw, { recursive: true });
	const t0 = Date.now();
	const log = (...a) => console.log(`[demo ${id} ${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
	const build = buildInfo();
	const vscode = await openVSCode({ files: mod.files ?? { 'README.md': '# My project\n' }, settings: mod.settings ?? {}, signedIn, log });
	const { page, app } = vscode;
	const ctx = helpers(page, app);
	ctx.scheme = build.quality === 'insider' ? 'vscode-insiders' : 'vscode';
	ctx.workspace = vscode.workspace;
	let recording = null, tracker = null;
	const steps = [];
	try {
		if (!signedIn) {
			await skipOnboarding(page);
		}
		if (typeof mod.setup === 'function') {
			await mod.setup({ ...ctx, mark: () => { }, step: () => { } });
		}
		await showCursor(page);
		await page.mouse.move(SIZE.width * 0.62, SIZE.height * 0.42);
		recording = await screencast(page, raw);
		tracker = markTracker(page);
		await sleep(400);
		const start = recording.frames[0]?.t ?? Date.now() / 1000;
		await mod.default({
			...ctx,
			mark: (name, locator, options) => tracker.mark(name, locator, options),
			step: label => steps.push({ label: String(label), t: +(Date.now() / 1000 - start).toFixed(2) }),
		});
		await sleep(600);
		const marks = await tracker.stop();
		tracker = null;
		const frames = await recording.stop();
		recording = null;
		if (frames.length < 2) {
			throw new Error('Nothing was recorded (no repaint)');
		}
		const first = frames[0].t;
		const duration = Date.now() / 1000 - first;
		// A frame arrives only when the window repaints: each one lasts until the next. Resampled to 30 fps, 2560x1440.
		const list = frames.map((f, i) => `file '${f.file}'\nduration ${(i + 1 < frames.length ? frames[i + 1].t - f.t : Math.max(0.05, first + duration - f.t)).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
		fs.writeFileSync(path.join(raw, 'frames.txt'), list);
		const ffmpeg = findFfmpeg();
		fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
		execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(raw, 'frames.txt'), '-vf', `fps=${FPS},scale=2560:1440:flags=lanczos`, '-q:v', '3', path.join(out, 'frames', '%05d.jpg')]);
		const count = fs.readdirSync(path.join(out, 'frames')).filter(f => f.endsWith('.jpg')).length;
		execFileSync(ffmpeg, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(out, 'frames', '%05d.jpg'), '-vf', 'scale=1280:720', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', path.join(out, 'clip.mp4')]);
		fs.rmSync(raw, { recursive: true, force: true });
		const info = {
			id, fps: FPS, count, duration: +(count / FPS).toFixed(2), size: [SIZE.width, SIZE.height], scale: 2,
			build, signedIn, recorded: new Date().toISOString(),
			steps: steps.map(s => ({ ...s, t: Math.max(0, +(s.t - (first - start)).toFixed(2)) })),
			marks: summarizeMarks(marks, first, count / FPS),
		};
		writeJson(path.join(out, 'demo.json'), info);
		await demoContact(out, info, path.join(out, 'contact.png'));
		log(`recorded ${info.duration} s (${count} frames) in ${build.name}${build.version ? ` ${build.version}` : ''}`);
		for (const [name, m] of Object.entries(info.marks)) {
			log(`  mark ${name}: ${m.rect ? `[${m.rect.join(', ')}] visible ${m.visible.map(([a, b]) => `${a}-${b} s`).join(', ')}` : 'NEVER VISIBLE: check the locator'}`);
		}
		for (const s of info.steps) {
			log(`  step ${s.t} s: ${s.label}`);
		}
		log(`look at ${path.relative(process.cwd(), path.join(out, 'contact.png'))} (and clip.mp4)`);
		return info;
	} catch (error) {
		await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => { });
		throw new Error(`${error.message.split('\n')[0]} (the window at that moment: ${path.join(out, 'failure.png')})`);
	} finally {
		await tracker?.stop().catch(() => { });
		await recording?.stop().catch(() => { });
		await vscode.close();
	}
}
