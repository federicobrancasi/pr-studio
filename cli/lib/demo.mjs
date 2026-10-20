// prs demo <slug> <id>: records a demo of VS Code for a changelog digest. Runs videos/<slug>/demos/<id>.mjs against a
// VS Code build in a throwaway profile, records the window, and logs where the UI the script marks is and when it is
// on screen, so the video's arrows land on it exactly.
//
// The demo script (an ES module):
//   export const files = { 'README.md': '# My project\n' };   // the workspace (optional)
//   export const settings = { 'editor.minimap.enabled': false };  // user settings (optional)
//   export async function setup({ page, run, ... }) { ... }   // before recording starts (optional)
//   export default async function demo({ page, run, mark, step, moveTo, click, type, press, sleep, openUrl }) { ... }
// mark(name, locator, { text }) logs that element's box and the times it is shown (with { text }: only while that text
// shows in it):
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
import { buildDir, findFfmpeg, isOffline, videoDir, writeJson } from './common.mjs';
import { launch } from './browser.mjs';
import { trackBoxAt } from '../../digest/track.js';

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
async function ensureDisplay(env = process.env) {
	if (process.platform !== 'linux' || env.DISPLAY) {
		return null;
	}
	for (let n = 90; n < 110; n++) {
		if (fs.existsSync(`/tmp/.X11-unix/X${n}`) || fs.existsSync(`/tmp/.X${n}-lock`)) {
			continue;
		}
		const xvfb = spawn('Xvfb', [`:${n}`, '-screen', '0', '2600x1500x24', '-nolisten', 'tcp'], { stdio: 'ignore', env });
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
/** Linux: kills every process started with this profile (a failed launch can leave VS Code's helpers running). */
function killProfileProcesses(marker) {
	if (process.platform !== 'linux') {
		return;
	}
	for (const pid of fs.readdirSync('/proc').filter(n => /^\d+$/.test(n) && Number(n) !== process.pid)) {
		try {
			if (fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(marker)) {
				process.kill(Number(pid), 'SIGKILL');
			}
		} catch { }
	}
}

/**
 * The fonts VS Code renders with on Linux: it looks like VS Code on a Mac (Inter is close to SF, and Menlo is based
 * on DejaVu Sans Mono). `packages` installs them on Ubuntu.
 */
export const LINUX_FONTS = { ui: 'Inter', mono: 'DejaVu Sans Mono', packages: 'fonts-inter fonts-dejavu-core fonts-dejavu-mono' };

/** fontconfig's default rules as Ubuntu enables them, minus colored sub-pixel edges (a recording is scaled). */
const FONT_RULES = {
	before: ['10-hinting-slight', '10-scale-bitmap-fonts', '10-sub-pixel-none', '10-yes-antialias', '20-unhint-small-vera', '30-metric-aliases', '40-nonlatin', '45-generic', '45-latin', '48-spacing', '49-sansserif'],
	after: ['60-generic', '60-latin', '65-fonts-persian', '65-nonlatin', '69-unifont', '70-no-bitmaps-except-emoji', '80-delicious', '90-synthetic'],
};

/**
 * pr-studio's font configuration for VS Code on Linux. It doesn't depend on /etc/fonts (a sandbox such as gh-aw's
 * doesn't mount it, and without its rules "sans-serif" and "monospace" map to no font: VS Code then renders in a
 * serif, and its terminal in a font that isn't monospaced). The system's default rules, then pr-studio's, before
 * 60-latin so they come first: the families VS Code asks for on Linux map to LINUX_FONTS.
 */
export function fontConfig({ cache, fonts = LINUX_FONTS, dirs = ['/usr/share/fonts', '/usr/local/share/fonts'], rules = '/usr/share/fontconfig/conf.avail' } = {}) {
	const include = names => names.map(n => `\t<include ignore_missing="yes">${rules}/${n}.conf</include>`);
	const prefer = (families, list) => families.map(f => `\t<alias binding="strong"><family>${f}</family><prefer>${list.map(x => `<family>${x}</family>`).join('')}</prefer></alias>`);
	return [
		'<?xml version="1.0"?>',
		'<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
		'<fontconfig>',
		...dirs.map(d => `\t<dir>${d}</dir>`),
		`\t<cachedir>${cache}</cachedir>`,
		...include(FONT_RULES.before),
		...prefer(['sans-serif', 'sans', 'system-ui', 'Ubuntu', 'Droid Sans'], [fonts.ui, 'DejaVu Sans', 'Liberation Sans']),
		...prefer(['monospace', 'mono', 'Droid Sans Mono', 'Ubuntu Mono'], [fonts.mono, 'Liberation Mono']),
		...prefer(['serif'], ['DejaVu Serif', 'Liberation Serif']),
		...include(FONT_RULES.after),
		'</fontconfig>',
		'',
	].join('\n');
}

/** On Linux, what is wrong with the fonts VS Code renders with: none when they are LINUX_FONTS. */
export function fontProblems(fonts, platform = process.platform) {
	if (platform !== 'linux') {
		return [];
	}
	const problems = [];
	if (!new RegExp(`^${LINUX_FONTS.ui}\\b`, 'i').test(fonts?.ui ?? '')) {
		problems.push(`its UI renders in ${fonts?.ui ?? 'no font'}, not ${LINUX_FONTS.ui}`);
	}
	if ((fonts?.mono ?? '').toLowerCase() !== LINUX_FONTS.mono.toLowerCase()) {
		problems.push(`its code renders in ${fonts?.mono ?? 'no font'}, not ${LINUX_FONTS.mono}`);
	}
	return problems;
}

/** The fonts VS Code renders its UI and its code with: DevTools' platform fonts of two sample texts in the window. */
export async function renderedFonts(page) {
	await page.evaluate(() => {
		const workbench = document.querySelector('.monaco-workbench') ?? document.body;
		// A file's editor (not the chat input's, in the UI font) when one is open, otherwise VS Code's default editor
		// fonts: the terminal uses the same.
		const editor = document.querySelector('.part.editor .monaco-editor .view-lines');
		const mono = editor ? getComputedStyle(editor).fontFamily : navigator.platform.startsWith('Mac') ? 'Menlo, Monaco, "Courier New", monospace' : navigator.platform.startsWith('Win') ? 'Consolas, "Courier New", monospace' : '"Droid Sans Mono", "monospace", monospace';
		for (const [id, family] of [['prs-font-ui', null], ['prs-font-mono', mono]]) {
			document.getElementById(id)?.remove();
			const el = document.createElement('span');
			el.id = id;
			el.textContent = 'Explorer Search Settings 0123456789';
			el.style.cssText = `position:fixed;left:-4000px;top:0;font-size:13px;white-space:nowrap;${family ? `font-family:${family};` : ''}`;
			workbench.appendChild(el);
		}
	});
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send('DOM.enable');
		await cdp.send('CSS.enable');
		const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
		const out = {};
		for (const [key, id] of [['ui', 'prs-font-ui'], ['mono', 'prs-font-mono']]) {
			const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${id}` });
			const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
			out[key] = [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0]?.familyName ?? null;
		}
		return out;
	} finally {
		await cdp.detach().catch(() => { });
		await page.evaluate(() => {
			for (const id of ['prs-font-ui', 'prs-font-mono']) {
				document.getElementById(id)?.remove();
			}
		}).catch(() => { });
	}
}

/**
 * Linux: what VS Code needs that a sandbox (gh-aw's agent firewall) changes. Its own runtime directory (it puts its
 * sockets there, and shows a blocking dialog when the inherited one is not writable), pr-studio's font configuration
 * (fontConfig), and the system's libraries rather than the copies of headless Chrome's that the sandbox puts first
 * (VS Code starts outside the sandbox with the system's). LD_PRELOAD is left alone.
 */
export function prepareLinuxEnv(env, tmp) {
	const run = path.join(tmp, 'run');
	fs.mkdirSync(run, { mode: 0o700 });
	env.XDG_RUNTIME_DIR = run;
	if (env.LD_LIBRARY_PATH) {
		const kept = env.LD_LIBRARY_PATH.split(':').filter(p => p && !p.startsWith('/run/awf-lib/'));
		if (kept.length) {
			env.LD_LIBRARY_PATH = kept.join(':');
		} else {
			delete env.LD_LIBRARY_PATH;
		}
	}
	const conf = path.join(tmp, 'fonts.conf');
	fs.writeFileSync(conf, fontConfig({ cache: path.join(tmp, 'fontconfig') }));
	env.FONTCONFIG_FILE = conf;
	delete env.FONTCONFIG_PATH;
}

/** Linux: the whole X display as a PNG (a dialog VS Code is stuck on), when xwd and ffmpeg are there. */
function captureDisplay(display, out, env) {
	try {
		const xwd = `${out}.xwd`;
		execFileSync('xwd', ['-root', '-silent', '-display', display, '-out', xwd], { env, timeout: 10_000, stdio: 'ignore' });
		execFileSync(findFfmpeg(), ['-v', 'error', '-y', '-i', xwd, '-vf', 'scale=1300:-1', out], { timeout: 20_000, stdio: 'ignore' });
		fs.rmSync(xwd, { force: true });
		return out;
	} catch {
		return null;
	}
}

/** The end of VS Code's own main-process log in a profile, if it wrote one. */
function mainLogTail(userData, lines = 40) {
	try {
		const logs = path.join(userData, 'logs');
		const latest = fs.readdirSync(logs).sort().at(-1);
		const text = fs.readFileSync(path.join(logs, latest, 'main.log'), 'utf8');
		return text.split('\n').slice(-lines).join('\n');
	} catch {
		return '';
	}
}

/** How long VS Code may take to open its window. */
const LAUNCH_TIMEOUT = 60_000;

/**
 * When VS Code exits during launch, Playwright rejects the launch, and also leaves a second promise rejected with
 * nobody listening: Node would exit on it before the launch error is reported. Ignore that one; anything else still
 * ends the process as usual.
 */
let launchNoiseIgnored = false;
function ignoreLaunchNoise() {
	if (launchNoiseIgnored) {
		return;
	}
	launchNoiseIgnored = true;
	process.on('unhandledRejection', reason => {
		if (!/^(Process failed to launch!|Unable to open X display)/.test(String(reason?.message ?? reason))) {
			process.nextTick(() => {
				throw reason;
			});
		}
	});
}

export async function openVSCode({ files = {}, settings = {}, signedIn = process.platform === 'darwin', log = console.log, failureShot = null } = {}) {
	const exe = vscodePath();
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prs-demo-'));
	let app, xserver;
	const cleanup = () => {
		try {
			app?.process()?.kill();
		} catch { }
		killProfileProcesses(tmp);
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
			// The terminal's text in the page (not a GPU canvas): a mark on it records what it says.
			'terminal.integrated.gpuAcceleration': 'off',
			// A brand-new profile shows a full-window onboarding overlay ("Welcome to VS Code", sign in): on a slow
			// machine it comes up seconds into a recording and covers it. This turns it off before the window opens.
			'workbench.welcomePage.experimentalOnboarding': false,
			...settings,
		});
		for (const [name, content] of Object.entries(files)) {
			fs.mkdirSync(path.dirname(path.join(workspace, name)), { recursive: true });
			fs.writeFileSync(path.join(workspace, name), content);
		}
		fs.mkdirSync(workspace, { recursive: true });
		const args = [
			`--user-data-dir=${data}`, `--extensions-dir=${path.join(tmp, 'extensions')}`,
			'--skip-release-notes', '--skip-welcome', '--disable-telemetry', '--disable-experiments', '--no-cached-data',
			'--disable-updates', '--disable-workspace-trust', '--new-window', workspace,
		];
		if (isOffline()) {
			// Offline (a sandbox whose only way out is its proxy): VS Code's requests fail here, without reaching it.
			args.unshift('--no-proxy-server');
			for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
				delete env[name];
			}
		}
		if (process.platform === 'linux') {
			prepareLinuxEnv(env, tmp);
			xserver = await ensureDisplay(env);
			if (xserver) {
				env.DISPLAY = xserver.display;
			}
			args.unshift('--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--password-store=basic', '--force-device-scale-factor=2');
		}
		ignoreLaunchNoise();
		try {
			app = await _electron.launch({ executablePath: exe, args, env, timeout: LAUNCH_TIMEOUT });
		} catch (error) {
			// Playwright's call log holds what VS Code printed: keep it whole, with VS Code's own log and the screen.
			const shot = failureShot && xserver ? captureDisplay(xserver.display, failureShot, env) : null;
			const main = mainLogTail(data);
			throw new LaunchError(error, exe, [main && `VS Code's main log (end):\n${main}`, shot && `The display: ${shot}`].filter(Boolean).join('\n\n'));
		}
		const page = await app.firstWindow({ timeout: LAUNCH_TIMEOUT });
		await app.evaluate(({ BrowserWindow }, s) => {
			const w = BrowserWindow.getAllWindows()[0];
			w.setPosition(40, 40);
			w.setContentSize(s.width, s.height);
		}, SIZE);
		await page.waitForSelector('.monaco-workbench', { timeout: LAUNCH_TIMEOUT });
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

/** VS Code started, but renders with the wrong fonts (Linux): a recording would look broken. */
export class FontError extends Error {
	constructor(problems, fonts) {
		super(`VS Code ${problems.join(', and ')}: a recording would look broken. Install the fonts (sudo apt-get install ${LINUX_FONTS.packages})`);
		this.fonts = fonts;
	}
}

/** VS Code did not start: the whole launch log is in `log`, its last lines in the message. */
export class LaunchError extends Error {
	constructor(error, exe, extra = '') {
		const log = `${String(error?.message ?? error)}${extra ? `\n\n${extra}` : ''}`;
		const tail = log.split('\n').map(l => l.trimEnd()).filter(Boolean).slice(-14).join('\n  ');
		super(`VS Code did not start (${exe}): ${log.split('\n')[0]}\n  ${tail}`);
		this.log = log;
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
	// On top: at least 2 of 3 points across its middle hit it (or something inside it): not covered by an overlay, not
	// a row of a list that isn't the one on screen. Elements that let clicks through hit their parent: that counts.
	const onTop = (el, r) => {
		let hits = 0;
		for (const fx of [0.5, 0.2, 0.8]) {
			const x = r.x + r.width * fx, y = r.y + r.height / 2;
			if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
				continue;
			}
			const hit = document.elementFromPoint(x, y);
			if (hit && (hit === el || el.contains(hit) || hit.contains(el))) {
				hits++;
			}
		}
		return hits >= 2;
	};
	for (const el of elements) {
		if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) {
			continue;
		}
		const box = el.getBoundingClientRect();
		let r = box;
		if (text) {
			// The words themselves (a sentence of a paragraph): a range over the text nodes that hold them. The mark counts
			// only while they show (and aren't covered); its box stays the element's: the ring goes around the whole UI.
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
		const inWindow = r.width > 2 && r.height > 2 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
		if (inWindow && onTop(el, r)) {
			// What it says: a demo proves it shows the PR's UI with it.
			const said = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
			return { x: box.x, y: box.y, width: box.width, height: box.height, text: said };
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
			for (const m of marks.values()) {
				// evaluateAll does not wait for a match: a mark that is not on screen costs nothing. Its time is when it was
				// measured (the middle of the call), so it matches the frame on screen then.
				const before = Date.now();
				const box = await m.locator.evaluateAll(measure, m.text).catch(() => null);
				m.samples.push({ t: (before + Date.now()) / 2000, box });
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

/**
 * Per mark: when it is really on screen (windows, clip seconds), where it is at each moment (track: [t, x, y, w, h]
 * of the samples it was on screen, about 10 a second), a representative box (rect: the middle of its longest window)
 * and what it said while on screen (text).
 */
export function summarizeMarks(marks, t0, duration, viewport = [SIZE.width, SIZE.height]) {
	const out = {};
	const r1 = v => +v.toFixed(1), r2 = v => +v.toFixed(2);
	// The frames are scaled to 1280x720 (2x): so are the boxes, if the page had another size.
	const kx = SIZE.width / viewport[0], ky = SIZE.height / viewport[1];
	const scale = b => b && { ...b, x: b.x * kx, y: b.y * ky, width: b.width * kx, height: b.height * ky };
	for (const [name, m] of marks) {
		const samples = m.samples.map(s => ({ t: r2(s.t - t0), box: scale(s.box) })).filter(s => s.t >= 0 && s.t <= duration + 0.05);
		const track = samples.filter(s => s.box).map(s => [s.t, r1(s.box.x), r1(s.box.y), r1(s.box.width), r1(s.box.height)]);
		const windows = [];
		let open = null;
		for (const s of samples) {
			if (s.box && !open) {
				open = { from: s.t, to: s.t, boxes: [] };
			}
			if (s.box) {
				open.to = s.t;
				open.boxes.push(s.box);
			} else if (open) {
				windows.push({ ...open, to: s.t });
				open = null;
			}
		}
		if (open) {
			windows.push({ ...open, to: r2(duration) });
		}
		// One missed sample between two where it sits at the same place is a glitch, not a disappearance.
		const merged = [];
		for (const w of windows) {
			const prev = merged.at(-1);
			const a = prev?.boxes.at(-1), b = w.boxes[0];
			if (prev && w.from - prev.to <= 0.35 && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 8) {
				prev.to = w.to;
				prev.boxes.push(...w.boxes);
			} else {
				merged.push({ ...w, boxes: [...w.boxes] });
			}
		}
		const kept = merged.filter(w => w.to - w.from >= 0.15);
		if (!kept.length) {
			out[name] = { rect: null, visible: [], texts: [], track: [], text: '' };
			continue;
		}
		const longest = kept.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
		const box = longest.boxes[Math.floor(longest.boxes.length / 2)];
		// Everything it said while on screen (a terminal fills up, a list filters): each different text once.
		const texts = [...new Set(kept.flatMap(w => w.boxes.map(b => b.text)).filter(Boolean))];
		out[name] = {
			rect: [box.x, box.y, box.width, box.height].map(r1),
			visible: kept.map(w => [Math.max(0, w.from), Math.min(duration, w.to)].map(r2)),
			// What it said in each of those windows: the arrow goes up only in one where it shows the proof.
			texts: kept.map(w => [...new Set(w.boxes.map(b => b.text).filter(Boolean))].join('\n').slice(0, 8000)),
			track,
			text: texts.join('\n').slice(0, 20000),
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
			const at = trackBoxAt(info.marks[n], t);
			if (!at) {
				return '';
			}
			const [x, y, w, h] = at.map(v => v / 2);
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

/**
 * prs demo check: starts VS Code once and says whether demos can be recorded here (about 20 s). Writes
 * videos/.demo-check.json (and .png: the window, or .log: why it did not start).
 */
export async function demoCheck() {
	const dir = videoDir('');
	fs.mkdirSync(dir, { recursive: true });
	const base = path.join(dir, '.demo-check');
	for (const ext of ['.json', '.png', '.log']) {
		fs.rmSync(base + ext, { force: true });
	}
	const t0 = Date.now();
	let build = null;
	try {
		build = buildInfo();
		const vscode = await openVSCode({ files: { 'README.md': '# Check\n' }, log: () => { }, failureShot: base + '.png' });
		let fonts;
		try {
			if (process.platform !== 'darwin') {
				await skipOnboarding(vscode.page);
			}
			await vscode.page.screenshot({ path: base + '.png' });
			fonts = await renderedFonts(vscode.page);
		} finally {
			await vscode.close();
		}
		const seconds = +((Date.now() - t0) / 1000).toFixed(1);
		const problems = fontProblems(fonts);
		if (problems.length) {
			throw new FontError(problems, fonts);
		}
		writeJson(base + '.json', { ok: true, build, fonts, seconds, at: new Date().toISOString() });
		console.log(`demos work here: ${build.name ?? 'VS Code'} ${build.version ?? ''} started in ${seconds} s, its UI in ${fonts.ui}, its code in ${fonts.mono} (${base}.png)`);
		return true;
	} catch (error) {
		fs.writeFileSync(base + '.log', error.log ?? String(error.stack ?? error));
		writeJson(base + '.json', { ok: false, build, ...(error.fonts ? { fonts: error.fonts } : {}), error: error.message.split('\n')[0], at: new Date().toISOString() });
		console.log(`demos don't work here: ${error.message}\n(the whole log: ${base}.log) Draw every chapter as a scene.`);
		return false;
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
	const failures = path.join(buildDir(slug), 'demos', 'launch-failures.log');
	const failed = fs.existsSync(failures) ? fs.readFileSync(failures, 'utf8').split('\n=====\n').filter(Boolean).length : 0;
	if (failed >= 2) {
		throw new Error(`VS Code failed to start ${failed} times in this project (${failures}): demos don't work here, draw this chapter as a scene`);
	}
	fs.rmSync(out, { recursive: true, force: true });
	const raw = path.join(out, 'raw');
	fs.mkdirSync(raw, { recursive: true });
	const t0 = Date.now();
	const log = (...a) => console.log(`[demo ${id} ${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
	const build = buildInfo();
	let vscode;
	try {
		vscode = await openVSCode({ files: mod.files ?? { 'README.md': '# My project\n' }, settings: mod.settings ?? {}, signedIn, log, failureShot: path.join(out, 'failure.png') });
	} catch (error) {
		fs.writeFileSync(path.join(out, 'failure.log'), error.log ?? String(error.stack ?? error));
		fs.appendFileSync(failures, `${new Date().toISOString()} demo ${id}\n${error.log ?? error.message}\n=====\n`);
		throw error;
	}
	const { page, app } = vscode;
	// Everything the demo types: a proof the demo typed itself (a search for the setting) proves nothing.
	const typed = [];
	for (const fn of ['type', 'insertText']) {
		const original = page.keyboard[fn].bind(page.keyboard);
		page.keyboard[fn] = (text, ...rest) => {
			typed.push(String(text));
			return original(text, ...rest);
		};
	}
	const ctx = helpers(page, app);
	ctx.scheme = build.quality === 'insider' ? 'vscode-insiders' : 'vscode';
	ctx.workspace = vscode.workspace;
	let recording = null, tracker = null, fonts = null;
	const steps = [];
	try {
		if (!signedIn) {
			await skipOnboarding(page);
		}
		fonts = await renderedFonts(page);
		const problems = fontProblems(fonts);
		if (problems.length) {
			const error = new FontError(problems, fonts);
			fs.appendFileSync(failures, `${new Date().toISOString()} demo ${id}\n${error.message}\n=====\n`);
			throw error;
		}
		if (typeof mod.setup === 'function') {
			await mod.setup({ ...ctx, mark: () => { }, step: () => { } });
		}
		await showCursor(page);
		await page.mouse.move(SIZE.width * 0.62, SIZE.height * 0.42);
		const viewport = await page.evaluate(() => [innerWidth, innerHeight]);
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
			build, signedIn, fonts, recorded: new Date().toISOString(),
			steps: steps.map(s => ({ ...s, t: Math.max(0, +(s.t - (first - start)).toFixed(2)) })),
			viewport, typed: typed.filter(x => x.length > 1),
			marks: summarizeMarks(marks, first, count / FPS, viewport),
		};
		writeJson(path.join(out, 'demo.json'), info);
		await demoContact(out, info, path.join(out, 'contact.png'));
		log(`recorded ${info.duration} s (${count} frames) in ${build.name}${build.version ? ` ${build.version}` : ''}, its UI in ${fonts?.ui}, its code in ${fonts?.mono}`);
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
