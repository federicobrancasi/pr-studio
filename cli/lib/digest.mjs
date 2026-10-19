// prs digest: the daily changelog video, one for the top picks of a #changelog report, in the "before → after" design
// (digest/player.js). The agent writes the project; prs digest builds and checks it.
//   prs digest new [--run id | --file report.md]   fetch the report's top picks into videos/changelog-<date>/
//   prs digest check [slug]                        what is missing or wrong (narration cues, marks, strip heights)
//   prs digest stills [slug] --at 3,12.5           single frames + a contact sheet (fast)
//   prs digest render [slug]                       the whole video, delivered with its captions and a summary
//   prs digest scenes                              the drawn scenes and their params
//
// videos/changelog-<date>/: brief.md (the picks), picks.json, digest.json (the chapters), storyboard.json (the
// narration: beats intro, c1..c5, outro; voiced with prs voice), demos/<id>.mjs (prs demo), scenes/<name>.js (own
// scenes, optional). Build output in build/digest/.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, buildDir, findFfmpeg, isOffline, loadConfig, readJson, videoDir, writeJson } from './common.mjs';
import { launch } from './browser.mjs';

const FPS = 30, CLIP_FPS = 30;
const CLIP_W = 1280, CLIP_H = 720;

/** The closest zoom (1 to 2) at which a box of the recording ([x, y, w, h]) still fits the view, with a margin. */
export function fitZoom([, , w, h]) {
	return Math.round(100 * Math.max(1, Math.min(2, 0.85 * CLIP_W / w, 0.85 * CLIP_H / h))) / 100;
}
export const VIEW_H = 675;
const STRIP = { eyebrow: [28, 14], head: [52, 12], row: [66, 10], rowTall: [84, 10], arrow: [40, 10], setting: [84, 0], settingState: [128, 0], settingGap: 16 };
export const TIMING = {
	lead: 0.45, tail: 0.4, clipHold: 0.3, cardTail: 0.6,
	introLead: 0.3, introTail: 0.4, outroLead: 0.35, outroTail: 1.2,
	fade: 0.2, tempo: 1,
};
const TIME_KEY = /^(at|from|until)$|At$/;
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const r3 = x => Math.round(x * 1000) / 1000;

/** The latest digest project (videos/changelog-<date>), or the one named. */
export function digestSlug(arg) {
	if (arg) {
		return arg;
	}
	const dir = path.join(ROOT, 'videos');
	const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => /^changelog-\d{4}-\d{2}-\d{2}$/.test(n)).sort() : [];
	if (!all.length) {
		throw new Error('No digest yet: run prs digest new');
	}
	return all.at(-1);
}

// ---------------------------------------------------------------------------------------------------------------
// prs digest new

/** The picks of a report and the PRs behind them, fetched; the project skeleton. */
export async function newDigest({ run = null, file = null } = {}) {
	const { downloadReport, parseReport, topPicks } = await import('./changelog.mjs');
	const text = file ? fs.readFileSync(file, 'utf8') : (await downloadReport({ run })).text;
	const report = parseReport(text);
	if (!report.date) {
		throw new Error(`The report has no date in its heading: ${report.title}`);
	}
	const picks = topPicks(report);
	if (!picks.length) {
		throw new Error('The report has no picks in its main message');
	}
	const slug = `changelog-${report.date}`;
	const dir = videoDir(slug);
	fs.mkdirSync(path.join(dir, 'demos'), { recursive: true });
	fs.writeFileSync(path.join(dir, 'report.md'), text);
	const { newVideo } = await import('./fetch.mjs');
	const { parsePrRef } = await import('./common.mjs');
	const { buildInfo } = await import('./demo.mjs');
	let build = null;
	try {
		build = buildInfo();
	} catch {
		build = null;
	}
	const entries = [];
	for (const pick of picks) {
		// A PR fetched before (for its own video, or an earlier digest) is reused: prs new refuses to start over.
		const ref = parsePrRef(pick.url);
		const known = path.join(videoDir(ref.slug), 'pr.json');
		const data = fs.existsSync(known) ? readJson(known) : (await newVideo(pick.url, undefined, { skeleton: false })).data;
		entries.push({
			rank: pick.rank, flag: pick.flag, warning: pick.warning, number: pick.number, url: pick.url, repo: pick.repo,
			title: pick.title, summary: pick.summary, author: pick.author ?? data.facts.authorLogin, slug: ref.slug,
			mergedAt: data.facts.mergedAt ?? null,
			inBuild: await inBuild(data.facts, build),
		});
	}
	writeJson(path.join(dir, 'picks.json'), { date: report.date, title: report.title, build, picks: entries });
	if (!fs.existsSync(path.join(dir, 'digest.json'))) {
		writeJson(path.join(dir, 'digest.json'), skeleton(report.date, entries));
	}
	if (!fs.existsSync(path.join(dir, 'storyboard.json'))) {
		writeJson(path.join(dir, 'storyboard.json'), { pronounce: {}, beats: ['intro', ...entries.map((_, i) => `c${i + 1}`), 'outro'].map(id => ({ id, need: 'digest', say: 'TODO', cues: {}, claims: [] })) });
	}
	writeJson(path.join(dir, 'pr.json'), { facts: {} });
	fs.writeFileSync(path.join(dir, 'brief.md'), brief(report, entries, build));
	return { slug, dir, picks: entries, build };
}

/** Whether the build contains the PR's merge commit (GitHub compare), or null when it can't be told. */
async function inBuild(facts, build) {
	if (!build?.commit || isOffline()) {
		return null;
	}
	try {
		const { api } = await import('./github.mjs');
		const pr = await api(`repos/${facts.repo}/pulls/${facts.number}`);
		if (!pr.merge_commit_sha) {
			return null;
		}
		const cmp = await api(`repos/${facts.repo}/compare/${pr.merge_commit_sha}...${build.commit}`);
		return cmp.status === 'ahead' || cmp.status === 'identical';
	} catch {
		return null;
	}
}

function skeleton(date, picks) {
	return {
		date,
		timing: {},
		chapters: Object.fromEntries(picks.map((p, i) => [`c${i + 1}`, {
			pick: p.rank,
			headline: 'TODO: what changed for users, 4-8 words',
			eyebrow: 'TODO: where it happens (optional)',
			before: { at: 'TODO: a phrase of this chapter\'s narration', rows: [{ id: 'old', text: 'TODO' }] },
			now: { at: 'TODO: the phrase that states the change', rows: [{ id: 'new', text: 'TODO' }] },
			visual: 'TODO: { "demo": "c' + (i + 1) + '" } or { "scene": { "name": "...", "params": { } } }',
			links: [],
		}])),
	};
}

function brief(report, picks, build) {
	const lines = [
		`# ${report.title}`, '',
		`The top ${picks.length} picks of the #changelog report: one chapter each, in this order. Read each PR's brief before writing its chapter.`,
		build ? `Demos run in ${build.name}${build.version ? ` ${build.version}` : ''} (commit ${build.commit?.slice(0, 10) ?? '?'}).` : 'No VS Code build found: set PRS_VSCODE before recording demos.', '',
	];
	for (const [i, p] of picks.entries()) {
		lines.push(
			`## c${i + 1} · ${p.rank}. ${p.flag ?? ''} #${p.number} ${p.title} (@${p.author})`.replace(/\s+/g, ' ').trim(), '',
			`- The report says: ${p.summary}`,
			`- The PR: ${p.url} · its brief: videos/${p.slug}/brief.md · its diff: videos/${p.slug}/pr.diff · its files at the head: \`node cli/prs.mjs file ${p.slug} <path>\``,
			`- In the demo build: ${p.inBuild === true ? 'yes' : p.inBuild === false ? '**no** (merged after the build: draw it as a scene)' : 'unknown'}`, '',
		);
	}
	lines.push('## The report', '', '```', report.title, '```');
	return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------------------------
// The timeline: segments from the narration, clip timing, time specs resolved to seconds of the video.

/** Absolute time of a phrase in a segment's words. */
function cueTime(words, phrase, nth = 0, where = '') {
	const want = String(phrase).split(/\s+/).map(norm).filter(Boolean);
	if (!want.length) {
		throw new Error(`Empty cue${where}`);
	}
	let hits = 0;
	for (let i = 0; i + want.length <= words.length; i++) {
		if (want.every((w, j) => norm(words[i + j].display) === w) && hits++ === nth) {
			return words[i].a;
		}
	}
	throw new Error(`Cue "${phrase}"${nth ? ` (#${nth + 1})` : ''} is not in the narration${where}: ${words.map(w => w.display).join(' ')}`);
}

/**
 * A time spec to seconds of the video: a number (seconds into the chapter), a phrase of the chapter's narration, or
 * { cue, nth, offset } | { mark, edge: 'start'|'end', nth, offset } (a demo mark on screen) | { step, offset }.
 */
export function resolveTime(spec, ctx, where = '') {
	if (spec === undefined || spec === null) {
		return undefined;
	}
	if (typeof spec === 'number') {
		return r3(ctx.start + spec);
	}
	if (typeof spec === 'string') {
		return r3(cueTime(ctx.words, spec, 0, where));
	}
	if (typeof spec === 'object') {
		const off = spec.offset ?? 0;
		if (spec.cue !== undefined) {
			return r3(cueTime(ctx.words, spec.cue, spec.nth ?? 0, where) + off);
		}
		if (spec.mark !== undefined) {
			const w = ctx.targets?.[spec.mark]?.windows?.[spec.nth ?? 0];
			if (!w) {
				throw new Error(`Mark "${spec.mark}" is never on screen${where}${ctx.targets ? ` (marks: ${Object.keys(ctx.targets).join(', ')})` : ': this chapter has no demo'}`);
			}
			return r3(w[spec.edge === 'end' ? 1 : 0] + off);
		}
		if (spec.step !== undefined) {
			const s = ctx.steps?.find(x => x.label === spec.step);
			if (!s) {
				throw new Error(`Step "${spec.step}" is not in the demo${where}`);
			}
			return r3(s.at + off);
		}
		if (spec.at !== undefined) {
			return resolveTime(spec.at, ctx, where);
		}
	}
	throw new Error(`Not a time${where}: ${JSON.stringify(spec)} (a phrase, seconds, { cue }, { mark } or { step })`);
}

/** Every time field (at, from, until, *At) of a spec, resolved; the rest copied. */
export function resolveTimes(value, ctx, where = '') {
	if (Array.isArray(value)) {
		return value.map((v, i) => resolveTimes(v, ctx, `${where}[${i}]`));
	}
	if (!value || typeof value !== 'object') {
		return value;
	}
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		out[k] = TIME_KEY.test(k) && (typeof v !== 'object' || v === null || v.cue !== undefined || v.mark !== undefined || v.step !== undefined || v.at !== undefined)
			? resolveTime(v, ctx, `${where}.${k}`)
			: resolveTimes(v, ctx, `${where}.${k}`);
	}
	return out;
}

/** A clip moment (seconds of the recording): a number, { mark, edge, nth, offset } or { step, offset }. */
function clipMoment(spec, demo, where) {
	if (typeof spec === 'number') {
		return spec;
	}
	if (spec?.mark !== undefined) {
		const w = demo.marks[spec.mark]?.visible?.[spec.nth ?? 0];
		if (!w) {
			throw new Error(`Mark "${spec.mark}" is never visible in demo ${demo.id}${where}`);
		}
		return w[spec.edge === 'end' ? 1 : 0] + (spec.offset ?? 0);
	}
	if (spec?.step !== undefined) {
		const s = demo.steps.find(x => x.label === spec.step);
		if (!s) {
			throw new Error(`Step "${spec.step}" is not in demo ${demo.id}${where}`);
		}
		return s.t + (spec.offset ?? 0);
	}
	throw new Error(`Not a moment of the recording${where}: ${JSON.stringify(spec)}`);
}

/** Strip height in pixels (it must fit the view: 675). */
export function stripHeight(ch) {
	let h = 0;
	const add = ([a, b]) => {
		h += a + b;
	};
	if (ch.eyebrow) {
		add(STRIP.eyebrow);
	}
	if (ch.before) {
		add(STRIP.head);
		for (const r of ch.before.rows ?? []) {
			add(r.sub || r.tone === 'orange' ? STRIP.rowTall : STRIP.row);
		}
		add(STRIP.arrow);
	}
	add(STRIP.head);
	for (const r of ch.now?.rows ?? []) {
		add(r.sub || r.tone === 'orange' ? STRIP.rowTall : STRIP.row);
	}
	if (ch.setting) {
		h += STRIP.settingGap;
		add(ch.setting.state ? STRIP.settingState : STRIP.setting);
	}
	return h;
}

function prettyDate(date) {
	const d = new Date(`${date}T12:00:00Z`);
	return {
		long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
		short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
	};
}

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

/** DATA for the page: segments with resolved chapter specs, clip timing, marks in video time; the audio plan. */
export function planDigest(slug) {
	const dir = videoDir(slug), bdir = buildDir(slug);
	const digest = readJson(path.join(dir, 'digest.json'));
	const picksDoc = readJson(path.join(dir, 'picks.json'));
	const tlFile = path.join(bdir, 'timeline.json');
	if (!fs.existsSync(tlFile)) {
		throw new Error(`No narration yet: write storyboard.json, then run prs voice ${slug}`);
	}
	const timeline = readJson(tlFile);
	const timing = { ...TIMING, ...(digest.timing ?? {}) };
	const tempo = timing.tempo || 1;
	const picks = new Map(picksDoc.picks.map(p => [p.rank, p]));
	const segments = [], words = [], audio = [];
	let at = 0, anyDemo = false;
	for (const beat of timeline.beats) {
		const kind = beat.id === 'intro' ? 'intro' : beat.id === 'outro' ? 'outro' : 'chapter';
		const lead = kind === 'chapter' ? timing.lead : kind === 'intro' ? timing.introLead : timing.outroLead;
		const narr = (beat.end - beat.start) / tempo;
		const segWords = beat.words.map(w => ({ a: r3(at + lead + (w.a - beat.start) / tempo), b: r3(at + lead + (w.b - beat.start) / tempo), display: w.display, seg: beat.id }));
		const where = ` (${beat.id})`;
		const seg = { id: beat.id, kind, start: r3(at), lead };
		let dur;
		if (kind === 'chapter') {
			const ch = digest.chapters?.[beat.id];
			if (!ch) {
				throw new Error(`digest.json has no chapter ${beat.id}`);
			}
			const pick = picks.get(ch.pick) ?? picksDoc.picks[Number(beat.id.slice(1)) - 1];
			const ctx = { start: at, words: segWords };
			const visual = ch.visual ?? {};
			let targets = {}, steps = [];
			if (visual.demo) {
				anyDemo = true;
				const ddir = path.join(bdir, 'demos', visual.demo);
				const demoFile = path.join(ddir, 'demo.json');
				if (!fs.existsSync(demoFile)) {
					throw new Error(`Demo "${visual.demo}" is not recorded${where}: run prs demo ${visual.demo}`);
				}
				const demo = readJson(demoFile);
				const clipSpec = ch.clip ?? {};
				// Where the recording stops (it holds its last frame): seconds, or a moment such as the end of a mark.
				const end = Math.min(clipSpec.end === undefined ? demo.duration : clipMoment(clipSpec.end, demo, `${where}.clip.end`), demo.count / CLIP_FPS);
				const pts = [[lead, 0]];
				for (const [i, a] of (clipSpec.anchors ?? []).entries()) {
					const v = resolveTime(a.at, ctx, `${where}.clip.anchors[${i}].at`) - at;
					pts.push([v, clipMoment(a.clip, demo, `${where}.clip.anchors[${i}].clip`)]);
				}
				for (let i = 1; i < pts.length; i++) {
					if (pts[i][0] < pts[i - 1][0] - 1e-6 || pts[i][1] < pts[i - 1][1]) {
						throw new Error(`${beat.id}: clip anchor ${i} (recording ${pts[i][1]} s at ${pts[i][0].toFixed(2)} s of the chapter) goes back in time`);
					}
				}
				const [vLast, cLast] = pts.at(-1);
				const vEnd = vLast + Math.max(0, end - cLast) / (clipSpec.after ?? 1);
				pts.push([vEnd, end]);
				dur = Math.max(lead + narr + timing.tail, vEnd + timing.clipHold);
				const clipAt = v => {
					if (v <= pts[0][0]) {
						return 0;
					}
					for (let i = 1; i < pts.length; i++) {
						const [v0, c0] = pts[i - 1], [v1, c1] = pts[i];
						if (v <= v1) {
							return v1 === v0 ? c1 : c0 + (v - v0) / (v1 - v0) * (c1 - c0);
						}
					}
					return end;
				};
				const inv = c => {
					for (let i = 1; i < pts.length; i++) {
						const [v0, c0] = pts[i - 1], [v1, c1] = pts[i];
						if (c <= c1) {
							return c1 === c0 ? v0 : v0 + (Math.max(c, c0) - c0) / (c1 - c0) * (v1 - v0);
						}
					}
					return vEnd;
				};
				const n = Math.ceil(dur * FPS) + 1;
				seg.clip = {
					dir: pathToFileURL(path.join(ddir, 'frames')).href, fps: FPS,
					map: Array.from({ length: n }, (_, k) => Math.max(1, Math.min(demo.count, Math.round(clipAt(k / FPS) * CLIP_FPS) + 1))),
					anchors: pts.map(([v, c]) => ({ at: r3(at + v), clip: c })),
				};
				for (const [name, m] of Object.entries(demo.marks)) {
					if (!m.rect) {
						continue;
					}
					const windows = m.visible.map(([a, b]) => [r3(at + inv(a)), r3(at + Math.min(inv(b), dur))]).filter(([a, b]) => b > a);
					targets[name] = { rect: m.rect, windows };
				}
				steps = demo.steps.map(s => ({ label: s.label, at: r3(at + inv(s.t)) }));
			} else if (visual.scene) {
				dur = lead + narr + timing.cardTail;
			} else {
				throw new Error(`${beat.id}: visual must be { "demo": id } or { "scene": { name, params } }`);
			}
			seg.end = r3(at + dur);
			const full = { start: at, end: at + dur, words: segWords, targets, steps };
			const { clip, visual: _v, pick: _p, ...rest } = ch;
			const spec = resolveTimes(rest, full, where);
			spec.camera = (spec.camera ?? []).map((c, i) => {
				let fx = c.fx, fy = c.fy, fit;
				if (c.focus) {
					const r = targets[c.focus]?.rect;
					if (!r) {
						throw new Error(`${beat.id}: camera[${i}].focus "${c.focus}" is not a mark of the demo`);
					}
					[fx, fy] = [r[0] + r[2] / 2, r[1] + r[3] / 2];
					fit = fitZoom(r);
				}
				// Focused on a mark without a zoom: as close as it still fits.
				return { at: c.at, dur: c.dur ?? 1, z: c.zoom ?? c.z ?? fit ?? 1, fx: fx ?? 640, fy: fy ?? 360 };
			});
			if (visual.scene) {
				spec.scene = { name: visual.scene.name, params: resolveTimes(visual.scene.params ?? {}, full, `${where}.visual.scene.params`) };
			}
			if (!spec.now?.rows?.length || spec.now.at === undefined) {
				throw new Error(`${beat.id}: "now" needs "at" (the phrase that states the change) and rows`);
			}
			const changed = spec.now.rows.filter(r => r.changed !== false && r.tone !== 'orange');
			spec.recap = spec.recap ?? { before: spec.before?.rows?.[0]?.text ?? null, now: (changed.length ? changed : spec.now.rows).map(r => r.text).join(' · '), mono: (changed[0] ?? spec.now.rows[0]).mono ?? false };
			Object.assign(spec, { rank: pick.rank, number: pick.number, author: pick.author, url: pick.url, flag: pick.flag });
			seg.spec = spec;
			seg.targets = targets;
		} else {
			dur = lead + narr + (kind === 'outro' ? timing.outroTail : timing.introTail);
			seg.end = r3(at + dur);
		}
		segments.push(seg);
		words.push(...segWords);
		audio.push({ from: beat.start - 0.04, to: beat.end + 0.3, at: at + lead - 0.04 / tempo });
		at += dur;
	}
	const { long, short } = prettyDate(digest.date ?? picksDoc.date);
	const build = picksDoc.build;
	const buildName = build ? `${build.name ?? 'VS Code'}${build.version ? ` ${build.version.replace(/-insider$/, '')}` : ''}` : 'VS Code';
	const n = segments.filter(s => s.kind === 'chapter').length;
	const meta = {
		title: 'VS Code Changelog', date: long, dateShort: short,
		subtitle: `the top ${NUMBERS[n] ?? n} changes merged in the last day`,
		build: buildName, channel: '#changelog',
		made: anyDemo ? `Demos recorded in ${buildName} · made with pr-studio` : 'Made with pr-studio',
		...(digest.meta ?? {}),
	};
	return { data: { meta, fps: FPS, total: r3(at), timing, segments, words }, audio, tempo };
}

// ---------------------------------------------------------------------------------------------------------------
// Proofs: what a chapter shows must be the PR's own text

/** Text as compared for proofs: case, spacing, mnemonics (&&), Markdown markers and escapes don't count. */
export function proofText(text) {
	return String(text ?? '').toLowerCase()
		.replace(/&&/g, '')
		.replace(/[\u2018\u2019]/g, '\'').replace(/[\u201c\u201d]/g, '"')
		.replace(/\\[nrt]/g, ' ')
		.replace(/[`*\\]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A PR's text, as compared for proofs: its strings with placeholders ({0}) match any value shown in their place. */
export function proofCorpus(raw) {
	const templates = [];
	for (const m of raw.matchAll(/"((?:[^"\\\n]|\\.)*\{\d+\}(?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*\{\d+\}(?:[^'\\\n]|\\.)*)'/g)) {
		const parts = proofText(m[1] ?? m[2]).split(/\{\d+\}/);
		if (parts.join('').trim().length >= 6) {
			templates.push(new RegExp(`^${parts.map(escapeRegExp).join('.+?')}$`));
		}
	}
	return { text: proofText(raw), templates };
}

/**
 * Whether a string is the PR's: in its text, or one of its strings with values in place of the placeholders. A
 * shortcut VS Code adds to a label ("New Chat (⌘T)", "Run (Ctrl+Enter)") is not part of it.
 */
export function inProof(corpus, text) {
	const t = proofText(text).replace(/\s*\((?:[⌘⌥⇧⌃]|(?:ctrl|cmd|alt|shift|meta|option)\+)[^)]*\)$/, '');
	return t.length > 0 && (corpus.text.includes(t) || corpus.templates.some(re => re.test(t)));
}

/** Everything a PR says: its title, its description, its diff and the files it changes, at its head (downloaded). */
function prCorpus(prSlug, cache) {
	if (!cache.has(prSlug)) {
		const dir = videoDir(prSlug);
		const pr = readJson(path.join(dir, 'pr.json'));
		const parts = [pr.facts?.title ?? '', pr.body ?? ''];
		if (fs.existsSync(path.join(dir, 'pr.diff'))) {
			parts.push(fs.readFileSync(path.join(dir, 'pr.diff'), 'utf8'));
		}
		const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
		for (const f of walk(path.join(buildDir(prSlug), 'src', pr.facts?.headSha9 ?? '-'))) {
			if (fs.statSync(f).size < 4_000_000) {
				parts.push(fs.readFileSync(f, 'utf8'));
			}
		}
		cache.set(prSlug, proofCorpus(parts.join('\n')));
	}
	return cache.get(prSlug);
}

/** When a link's arrow starts, as the player does: its "from", or just after its row appears. */
function linkStart(spec, link) {
	if (link.from !== undefined) {
		return link.from;
	}
	const rowAt = (rows, base, offset) => {
		const i = (rows ?? []).findIndex(r => r.id === link.row);
		return i < 0 ? undefined : rows[i].at ?? base + offset + 0.12 * i;
	};
	return (rowAt(spec.now?.rows, spec.now?.at, 0) ?? (spec.before ? rowAt(spec.before.rows, spec.before.at, 0.15) : undefined) ?? spec.now?.at) + 0.45;
}

/**
 * When a link's arrow can be up: its from and until, and when its target is on screen (a scene's part: null when
 * these params don't draw it; a demo's mark: as the player shows it, through the hold on the recording's last frame).
 */
function linkTiming(seg, link, kit) {
	const spec = seg.spec;
	const from = linkStart(spec, link), until = link.until ?? seg.end;
	if (spec.scene) {
		const w = kit[spec.scene.name]?.windows(spec.scene.params ?? {}, { start: seg.start, end: seg.end }) ?? {};
		return { from, until, windows: w[link.target] ? [w[link.target]] : null, parts: w };
	}
	const last = seg.clip?.anchors?.at(-1)?.at ?? seg.end;
	return { from, until, windows: (seg.targets[link.target]?.windows ?? []).map(([a, b]) => [a, b >= last - 0.02 ? seg.end : b]), parts: null };
}

/** The arrows that would ring nothing: a target these params don't draw, or one never on screen while the arrow is. */
export function linkProblems(seg, kit) {
	const problems = [];
	const spec = seg.spec;
	const fmt = x => x.toFixed(1);
	for (const l of spec.links ?? []) {
		if (spec.scene && !kit[spec.scene.name]) {
			continue;
		}
		const { from, until, windows, parts } = linkTiming(seg, l, kit);
		for (const other of parts ? [l.stop, l.also].filter(Boolean) : []) {
			if (!parts[other]) {
				problems.push(`${seg.id}: the arrow to "${l.target}" uses "${other}", which these ${spec.scene.name} params don't draw`);
			}
		}
		if (!windows) {
			problems.push(`${seg.id}: the arrow from "${l.row}" points to "${l.target}", which these ${spec.scene.name} params don't draw: it would ring nothing`);
			continue;
		}
		const overlap = windows.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, until) - Math.max(a, from)), 0);
		if (overlap < 0.4) {
			problems.push(`${seg.id}: the arrow from "${l.row}" (${fmt(from)}-${fmt(until)} s) is never up while "${l.target}" is on screen (${windows.map(([a, b]) => `${fmt(a)}-${fmt(b)} s`).join(', ') || 'never'}): move its from/until, or the scene's times`);
		}
	}
	return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// prs digest check

export async function checkDigest(slug) {
	const dir = videoDir(slug), bdir = buildDir(slug);
	const problems = [], notes = [];
	const digest = readJson(path.join(dir, 'digest.json'));
	const storyboard = readJson(path.join(dir, 'storyboard.json'));
	const picks = readJson(path.join(dir, 'picks.json')).picks;
	const ids = picks.map((_, i) => `c${i + 1}`);
	for (const b of storyboard.beats) {
		if (!b.say || /TODO/.test(b.say)) {
			problems.push(`storyboard.json: beat ${b.id} has no narration yet`);
		}
	}
	const words = storyboard.beats.reduce((n, b) => n + String(b.say ?? '').split(/\s+/).filter(Boolean).length, 0);
	notes.push(`narration: ${words} words (about 150 make a 55-60 s video)`);
	if (words > 175) {
		problems.push(`the narration has ${words} words: cut it to about 150 (the video should run under a minute)`);
	}
	const kit = await loadSceneDocs();
	const corpora = new Map();
	for (const [i, id] of ids.entries()) {
		const ch = digest.chapters?.[id];
		if (!ch) {
			problems.push(`digest.json: no chapter ${id}`);
			continue;
		}
		const pick = picks.find(p => p.rank === ch.pick) ?? picks[i];
		let corpus = null;
		try {
			corpus = prCorpus(pick.slug, corpora);
		} catch (error) {
			problems.push(`${id}: can't read #${pick.number} to check what the chapter shows (${error.message.split('\n')[0]})`);
		}
		const isPr = text => !corpus || inProof(corpus, text);
		const where = `#${pick.number} (its diff, the files it changes, its title or description)`;
		if (ch.setting?.name && !isPr(ch.setting.name)) {
			problems.push(`${id}: the setting "${ch.setting.name}" is not in ${where}`);
		}
		const rowIds = new Set([...(ch.before?.rows ?? []), ...(ch.now?.rows ?? [])].map(r => r.id));
		for (const l of ch.links ?? []) {
			if (!rowIds.has(l.row)) {
				problems.push(`${id}: a link starts at row "${l.row}", which is not a row of the strip (rows: ${[...rowIds].join(', ')})`);
			}
		}
		const scene = ch.visual?.scene;
		if (scene) {
			const kind = kit[scene.name];
			if (!kind) {
				problems.push(`${id}: there is no scene "${scene.name}" (scenes: ${Object.keys(kit).join(', ')})`);
			} else {
				for (const t of (ch.links ?? []).flatMap(l => [l.target, l.stop, l.also]).filter(Boolean)) {
					if (!kind.targets.includes(t)) {
						problems.push(`${id}: "${t}" is not a target of the ${scene.name} scene (targets: ${kind.targets.join(', ')})`);
					}
				}
				// A drawn UI shows the PR's own strings: a scene drawn with made-up text would show a UI that doesn't exist.
				for (const proof of kind.proofs(scene.params ?? {})) {
					if (!proof.text) {
						problems.push(`${id}: the ${scene.name} scene needs ${proof.param}: the PR's own text (or show the change on a card)`);
					} else if (!isPr(proof.text)) {
						problems.push(`${id}: "${proof.text}" (${scene.name}, ${proof.param}) is not in ${where}: draw only the PR's own strings, or show the change on a card`);
					}
				}
			}
		}
		const text = JSON.stringify(ch);
		if (/TODO/.test(text)) {
			problems.push(`${id}: still has TODOs`);
		}
		if ((ch.headline ?? '').length > 52) {
			problems.push(`${id}: the headline is ${ch.headline.length} characters; keep it under 52 (one line)`);
		}
		for (const r of [...(ch.before?.rows ?? []), ...(ch.now?.rows ?? [])]) {
			if (String(r.text ?? '').length > 30 && r.tone !== 'orange') {
				problems.push(`${id}: the row "${r.text}" is long (${r.text.length} characters; about 30 fit, or use sub for a second line)`);
			}
		}
		const h = stripHeight(ch);
		if (h > VIEW_H) {
			problems.push(`${id}: the strip is ${h} px tall; it must fit ${VIEW_H} px (fewer rows, no eyebrow, or no setting card)`);
		}
		const v = ch.visual ?? {};
		if (v.demo) {
			const f = path.join(bdir, 'demos', v.demo, 'demo.json');
			if (!fs.existsSync(f)) {
				problems.push(`${id}: demo "${v.demo}" not recorded yet (prs demo ${v.demo})`);
			} else {
				const demo = readJson(f);
				const used = new Set([...(ch.links ?? []).flatMap(l => [l.target, l.stop, l.also]), ...(ch.camera ?? []).map(c => c.focus)].filter(Boolean));
				for (const m of used) {
					if (!demo.marks[m]) {
						problems.push(`${id}: "${m}" is not a mark of demo ${v.demo} (marks: ${Object.keys(demo.marks).join(', ') || 'none'})`);
					} else if (!demo.marks[m].visible.length) {
						problems.push(`${id}: mark "${m}" is never on screen in demo ${v.demo}: look at its contact sheet`);
					}
				}
				// The demo shows the PR's UI: text from the PR, in a mark a Now row points to.
				const proofs = [].concat(ch.proof ?? []);
				const nowRows = new Set((ch.now?.rows ?? []).map(r => r.id));
				const shown = (ch.links ?? []).filter(l => nowRows.has(l.row)).map(l => proofText(demo.marks[l.target]?.text)).join('\n');
				if (!proofs.length) {
					problems.push(`${id}: a demo needs "proof": text from #${pick.number} that it shows (a label, a setting's description, a command), in a mark a Now row points to`);
				}
				for (const proof of proofs) {
					if (proofText(proof).length < 10) {
						problems.push(`${id}: the proof "${proof}" is too short to prove anything: 10 characters or more`);
					} else if (!isPr(proof)) {
						problems.push(`${id}: the proof "${proof}" is not in ${where}`);
					} else if (!shown.includes(proofText(proof))) {
						problems.push(`${id}: no mark a Now row points to shows "${proof}": point one at the UI that says it (or this demo doesn't show the change: use a scene or a card)`);
					}
				}
				for (const c of ch.camera ?? []) {
					const r = c.focus && demo.marks[c.focus]?.rect;
					const z = c.zoom ?? c.z;
					if (r && z && z > fitZoom(r) + 0.05) {
						problems.push(`${id}: a zoom of ${z} crops "${c.focus}" (it fits up to ${fitZoom(r)}): leave "zoom" out to fit it`);
					}
				}
			}
		} else if (!v.scene) {
			problems.push(`${id}: visual must be { "demo": id } or { "scene": { name, params } }`);
		}
	}
	if (fs.existsSync(path.join(bdir, 'timeline.json'))) {
		try {
			const { data } = planDigest(slug);
			for (const seg of data.segments.filter(x => x.kind === 'chapter')) {
				problems.push(...linkProblems(seg, kit));
			}
			notes.push(`video: ${data.total.toFixed(1)} s (${data.segments.map(x => `${x.id} ${(x.end - x.start).toFixed(1)}`).join(', ')})`);
			if (data.total > 75) {
				problems.push(`the video runs ${data.total.toFixed(1)} s: aim for 55-65 s (shorter narration, faster clips: clip.after)`);
			}
		} catch (error) {
			problems.push(error.message);
		}
	} else {
		notes.push(`no narration audio yet: prs voice ${slug}`);
	}
	return { problems, notes };
}

// ---------------------------------------------------------------------------------------------------------------
// The page and the frames

const esbuild = createRequire(path.join(ROOT, 'package.json'))('esbuild');

async function buildPage(slug, data) {
	const pdir = path.join(buildDir(slug), 'digest', 'page');
	fs.mkdirSync(pdir, { recursive: true });
	const entry = path.join(pdir, 'entry.js');
	fs.writeFileSync(entry, [
		`import createPlayer from ${JSON.stringify(path.join(ROOT, 'digest', 'player.js'))};`,
		'const player = createPlayer(document.getElementById(\'app\'), window.DATA);',
		'window.seek = async t => player.seek(t);',
		'window.chunks = () => player.chunks();',
		'window.ready = async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === \'loaded\').map(f => `${f.family} ${f.weight}`); };',
	].join('\n'));
	await esbuild.build({
		entryPoints: [entry], bundle: true, format: 'iife', platform: 'browser', outfile: path.join(pdir, 'bundle.js'),
		loader: { '.svg': 'text' }, logLevel: 'error', absWorkingDir: ROOT, target: 'chrome120',
	});
	const css = ['theme/studio.css', 'digest/style.css'].map(f => `<link rel="stylesheet" href="${pathToFileURL(path.join(ROOT, f)).href}">`).join('');
	const html = path.join(pdir, 'index.html');
	fs.writeFileSync(html, `<!doctype html><html lang="en"><head><meta charset="utf-8">${css}
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#fff}#app{position:relative;width:1920px;height:1080px;overflow:hidden;background:#fff;font-family:Aptos,'Segoe UI',Inter,sans-serif;color:var(--ink)}</style>
</head><body><div id="app"></div><script>window.DATA=${JSON.stringify(data).replace(/</g, '\\u003c')}</script><script src="bundle.js?v=${Date.now()}"></script></body></html>`);
	return html;
}

/** Screenshots of the page at the given times, in parallel browsers; returns the caption phrases. */
async function capture(html, shots, type, workers) {
	const n = Math.max(1, Math.min(workers, shots.length));
	const browsers = await Promise.all(Array.from({ length: n }, () => launch()));
	let chunks = [];
	try {
		await Promise.all(browsers.map(async (browser, w) => {
			const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
			const errors = [];
			page.on('pageerror', e => errors.push(e.stack || e.message));
			page.on('console', m => m.type() === 'error' && !/Aptos/.test(m.location()?.url ?? '') && errors.push(m.text()));
			await page.route('**/*', r => (/^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort()));
			await page.goto(pathToFileURL(html).href);
			await page.evaluate(() => window.ready());
			if (w === 0) {
				chunks = await page.evaluate(() => window.chunks());
			}
			const from = Math.floor(shots.length * w / n), to = Math.floor(shots.length * (w + 1) / n);
			for (let i = from; i < to; i++) {
				await page.evaluate(t => window.seek(t), shots[i].t);
				await page.screenshot({ path: shots[i].file, type, ...(type === 'jpeg' ? { quality: 93 } : {}) });
			}
			if (errors.length) {
				throw new Error(`The page reported errors:\n${errors.join('\n')}`);
			}
		}));
	} finally {
		await Promise.all(browsers.map(b => b.close()));
	}
	return chunks;
}

function grid(ffmpeg, files, out, cols = 3) {
	const rows = Math.ceil(files.length / cols);
	const pads = cols * rows - files.length;
	const inputs = files.flatMap(f => ['-i', f]);
	const scaled = [...files.map((_, i) => `[${i}]scale=640:-1[s${i}]`), ...Array.from({ length: pads }, (_, k) => `color=white:s=640x360[p${k}]`)];
	const cells = [...files.map((_, i) => `[s${i}]`), ...Array.from({ length: pads }, (_, k) => `[p${k}]`)];
	const lines = Array.from({ length: rows }, (_, r) => `${cells.slice(r * cols, r * cols + cols).join('')}${cols > 1 ? `hstack=${cols}` : 'null'}[r${r}]`);
	execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', `${scaled.join(';')};${lines.join(';')};${Array.from({ length: rows }, (_, r) => `[r${r}]`).join('')}${rows > 1 ? `vstack=${rows}` : 'null'}`, '-frames:v', '1', out]);
}

/** Key moments of each segment: for a contact sheet. */
function keyMoments(data) {
	const times = [];
	for (const s of data.segments) {
		if (s.kind !== 'chapter') {
			times.push(r3(s.end - 0.8));
			continue;
		}
		const sp = s.spec;
		times.push(r3(Math.max(s.start + 1.2, sp.now.at - 0.3)));
		times.push(r3(Math.min(s.end - 0.6, sp.now.at + 1.6)));
		times.push(r3(s.end - 0.5));
	}
	return times;
}

/**
 * The moment to review each chapter at: when its first Now arrow is fully drawn on its target (or its middle, with
 * no arrow), so a still shows the UI, the arrow and what it points at together.
 */
function reviewMoments(data, kit) {
	return data.segments.filter(s => s.kind === 'chapter').map(seg => {
		const nowRows = new Set((seg.spec.now?.rows ?? []).map(r => r.id));
		const link = (seg.spec.links ?? []).find(l => nowRows.has(l.row)) ?? seg.spec.links?.[0];
		let t = (seg.start + seg.end) / 2;
		if (link) {
			const { from, until, windows } = linkTiming(seg, link, kit);
			const w = (windows ?? []).find(([a, b]) => Math.min(b, until) > Math.max(a, from));
			if (w) {
				const a = Math.max(from, w[0]), b = Math.min(until, w[1]);
				t = Math.min(a + 1.0, b - 0.1);
			}
		}
		return { id: seg.id, t: r3(Math.max(seg.start + 0.6, Math.min(seg.end - 0.2, t))) };
	});
}

export async function stillsDigest(slug, { at = null, workers = 3 } = {}) {
	const { data } = planDigest(slug);
	const html = await buildPage(slug, data);
	const dir = path.join(buildDir(slug), 'digest', 'stills');
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(dir, { recursive: true });
	const times = (at ?? keyMoments(data)).filter(t => t >= 0 && t <= data.total);
	const shots = times.map((t, i) => ({ t, file: path.join(dir, `${String(i + 1).padStart(2, '0')}-${t.toFixed(2)}s.png`) }));
	// One full-size still per chapter, for the review: each must be opened (the contact sheet is too small to judge).
	const review = at ? [] : reviewMoments(data, await loadSceneDocs()).map(m => ({ ...m, file: path.join(dir, `review-${m.id}.png`) }));
	await capture(html, [...shots, ...review], 'png', workers);
	grid(findFfmpeg(), shots.map(s => s.file), path.join(dir, 'contact.png'));
	return { dir, shots, review, total: data.total };
}

export async function renderDigest(slug, { workers = 3 } = {}) {
	const { data, audio, tempo } = planDigest(slug);
	const bdir = buildDir(slug), out = path.join(bdir, 'digest');
	fs.mkdirSync(out, { recursive: true });
	writeJson(path.join(out, 'timeline.json'), data);
	const ffmpeg = findFfmpeg();
	const wav = path.join(out, 'audio.wav');
	const tempoFilter = tempo === 1 ? '' : `,atempo=${tempo}`;
	const parts = audio.map((p, i) => `[s${i}]atrim=start=${Math.max(0, p.from).toFixed(3)}:end=${p.to.toFixed(3)},asetpts=PTS-STARTPTS${tempoFilter},adelay=delays=${Math.max(0, Math.round(p.at * 1000))}:all=1[a${i}]`);
	execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', path.join(bdir, 'narration.wav'), '-filter_complex',
		`[0:a]asplit=${audio.length}${audio.map((_, i) => `[s${i}]`).join('')};${parts.join(';')};${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0:dropout_transition=0,apad=whole_dur=${data.total}[out]`,
		'-map', '[out]', '-ar', '48000', '-ac', '1', wav]);
	const html = await buildPage(slug, data);
	const frames = path.join(out, 'frames');
	fs.rmSync(frames, { recursive: true, force: true });
	fs.mkdirSync(frames, { recursive: true });
	const count = Math.ceil(data.total * FPS);
	const t0 = performance.now();
	const chunks = await capture(html, Array.from({ length: count }, (_, i) => ({ t: i / FPS, file: path.join(frames, `${String(i + 1).padStart(5, '0')}.jpg`) })), 'jpeg', workers);
	console.log(`${count} frames in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
	const mp4 = path.join(out, `${slug}.mp4`);
	execFileSync(ffmpeg, ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', wav, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
		'-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', mp4]);
	const stamp = s => {
		const ms = Math.round(s * 1000);
		return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
	};
	const srt = path.join(out, `${slug}.srt`);
	fs.writeFileSync(srt, chunks.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(Math.min(c.end, data.total))}\n${c.text}\n`).join('\n'));
	const sheet = keyMoments(data).map(t => path.join(frames, `${String(Math.min(count, Math.round(t * FPS) + 1)).padStart(5, '0')}.jpg`));
	grid(ffmpeg, sheet, path.join(out, 'contact.png'));
	fs.rmSync(frames, { recursive: true, force: true });
	// Deliver: the mp4, its captions, the contact sheet and what a job needs to post it (to Slack).
	const picks = readJson(path.join(videoDir(slug), 'picks.json'));
	const voice = fs.existsSync(path.join(bdir, 'voice.json')) ? readJson(path.join(bdir, 'voice.json')).provider : null;
	const dest = path.join(loadConfig().deliver, slug);
	fs.mkdirSync(dest, { recursive: true });
	for (const f of [mp4, srt]) {
		fs.copyFileSync(f, path.join(dest, path.basename(f)));
	}
	fs.copyFileSync(path.join(out, 'contact.png'), path.join(dest, 'contact.png'));
	writeJson(path.join(dest, `${slug}.json`), {
		kind: 'changelog-digest', date: picks.date, title: `${data.meta.title} — ${data.meta.dateShort}`, seconds: data.total,
		mp4: `${slug}.mp4`, srt: `${slug}.srt`, voice, build: data.meta.build,
		picks: data.segments.filter(s => s.kind === 'chapter').map(s => ({ rank: s.spec.rank, flag: s.spec.flag, number: s.spec.number, url: s.spec.url, author: s.spec.author, headline: s.spec.headline, demo: !!s.clip })),
		published: new Date().toISOString(),
	});
	return { mp4: path.join(dest, `${slug}.mp4`), total: data.total, contact: path.join(out, 'contact.png') };
}

/** The scene kit, for Node: names, docs, params, windows and proofs (bundled: their icons are SVG files). */
export async function loadSceneDocs() {
	const out = path.join(ROOT, 'videos', '.scenes.node.mjs');
	fs.mkdirSync(path.dirname(out), { recursive: true });
	await esbuild.build({
		entryPoints: [path.join(ROOT, 'digest', 'scenes', 'index.js')], bundle: true, platform: 'node', format: 'esm', outfile: out,
		loader: { '.svg': 'text', '.css': 'empty' }, logLevel: 'silent', absWorkingDir: ROOT,
	});
	const { SCENES } = await import(`${pathToFileURL(out).href}?v=${Date.now()}`);
	return SCENES;
}

// ---------------------------------------------------------------------------------------------------------------
// The command

export async function digestCommand(args) {
	const sub = args._[0];
	switch (sub) {
		case 'new': {
			const { slug, picks, build } = await newDigest({ run: args.run ?? null, file: args.file ?? null });
			console.log(`videos/${slug}: ${picks.length} picks${build ? `, demos in ${build.name} ${build.version ?? ''}` : ''}`);
			for (const [i, p] of picks.entries()) {
				console.log(`  c${i + 1} #${p.number} ${p.title}${p.inBuild === false ? '  (not in the demo build)' : ''}`);
			}
			console.log(`  read videos/${slug}/brief.md; write storyboard.json and digest.json (guides/digest.md)`);
			return 0;
		}
		case 'check': {
			const slug = digestSlug(args._[1]);
			const { problems, notes } = await checkDigest(slug);
			for (const n of notes) {
				console.log(n);
			}
			for (const p of problems) {
				console.log(`✗ ${p}`);
			}
			console.log(problems.length ? `${problems.length} problem(s)` : 'ready: prs digest stills, then prs digest render');
			return problems.length ? 1 : 0;
		}
		case 'stills': {
			const slug = digestSlug(args._[1]);
			const at = typeof args.at === 'string' ? args.at.split(',').map(Number) : null;
			const { dir, shots, review, total } = await stillsDigest(slug, { at, workers: Number(args.workers ?? 3) });
			console.log(`video ${total.toFixed(1)} s; stills: ${shots.map(s => path.basename(s.file)).join(', ')}`);
			console.log(`contact sheet: ${path.relative(process.cwd(), path.join(dir, 'contact.png'))}`);
			if (review.length) {
				console.log(`review: open each, full size (guides/digest.md, "Review"): ${review.map(r => `${path.relative(process.cwd(), r.file)} (${r.t.toFixed(2)} s)`).join(', ')}`);
			}
			return 0;
		}
		case 'render': {
			const slug = digestSlug(args._[1]);
			const { problems } = await checkDigest(slug);
			if (problems.length && !args.force) {
				for (const p of problems) {
					console.log(`✗ ${p}`);
				}
				console.log('fix these first (or --force)');
				return 1;
			}
			const { mp4, total, contact } = await renderDigest(slug, { workers: Number(args.workers ?? 3) });
			console.log(`delivered: ${mp4} (${total.toFixed(1)} s); contact sheet: ${path.relative(process.cwd(), contact)}`);
			return 0;
		}
		case 'scenes': {
			const SCENES = await loadSceneDocs();
			for (const s of Object.values(SCENES)) {
				console.log(`${s.name}: ${s.doc}`);
				for (const [k, v] of Object.entries(s.params)) {
					console.log(`    ${k}: ${v}`);
				}
				console.log(`    targets: ${s.targets.join(', ')}`);
			}
			return 0;
		}
		default:
			console.log('prs digest new [--run id | --file report.md] | check | stills [--at 1,2] | render | scenes');
			return sub ? 1 : 0;
	}
}
