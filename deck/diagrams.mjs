// Diagram layouts (v5): shapes that carry the idea, so the slide needs few words. Same look, tones and checks as
// layouts.mjs: every text block carries data-t, every box that could overflow carries data-fit.
import fs from 'node:fs';
import path from 'node:path';
import { LOGOS } from './theme/logos/logos.mjs';
import { ROOT, deckFile, htmlRef, esc, fmt, ic, iconTile, pill, stepTone, heading, body, bodyHeight, arrowHead, arrowSvg, pngSize } from './layouts.mjs';

const W = 1728;
const r1 = v => Math.round(v * 10) / 10;

const logoCache = new Map();
/** A brand mark from deck/theme/logos (Simple Icons), in its brand colour unless a colour is given. */
export function logo(slug, size = 48, color = null) {
	const meta = LOGOS[slug];
	if (!meta) {
		throw new Error(`Unknown logo "${slug}". Known logos: ${Object.keys(LOGOS).join(', ')}`);
	}
	if (!logoCache.has(slug)) {
		logoCache.set(slug, fs.readFileSync(path.join(ROOT, 'deck', 'theme', 'logos', `${slug}.svg`), 'utf8').replace(/<title>[^<]*<\/title>/, ''));
	}
	return `<span class="logo" style="width:${size}px;height:${size}px">${logoCache.get(slug).replace('<svg ', `<svg fill="${color ?? meta.hex}" `)}</span>`;
}

function notesList(callouts) {
	return callouts?.length ? `<div class="ui-notes">${callouts.map((nt, k) => `<div class="unote t-${nt.tone ?? stepTone(k)}"><span class="st-badge" style="width:40px;height:40px;font-size:18px;background:var(--fg)" data-t>${k + 1}</span><div><div class="t" data-t>${fmt(nt.title)}</div>${nt.text ? `<div class="s" data-t>${fmt(nt.text)}</div>` : ''}</div></div>`).join('')}</div>` : '';
}

function bezier(p0, p1, p2, p3, t) {
	const u = 1 - t;
	return {
		x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
		y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
	};
}

/** The "who" line of a story: an icon and a few words, no chip. */
function storyWho(s, style = '') {
	return s.who ? `<div class="sx-who" style="${style}" data-t>${ic(s.who.icon ?? 'building', 28)}<span>${fmt(s.who.text)}</span></div>` : '';
}

/** Full-page looks for the story layout (v8). Same data as the classic look: who, beats, outcome; the outcome is part
 * of the picture instead of a box on the side. Pick one with `look`. */
const STORY_LOOKS = {
	/** One wide road across the page: a big stop per beat, the outcome as the last, bigger stop. */
	road(s) {
		const H = bodyHeight(s);
		const o = s.outcome;
		const tone = o?.tone ?? 'green';
		const n = s.beats.length;
		const ow = o ? 520 : 0;
		const bw = (W - ow) / n;
		const dot = 108;
		const cap = 196;
		const roadY = Math.round((s.who ? 64 : 0) + (H - (s.who ? 64 : 0)) * 0.4);
		const stops = s.beats.map((b, i) => {
			const bt = b.tone ?? 'neutral';
			const left = bw * i + 12;
			return `<div class="rd-stop t-${bt}" style="left:${r1(left)}px;width:${r1(bw - 24)}px;height:${H}px">${b.time ? `<div class="sx-time rd-time" style="bottom:${r1(H - roadY + dot / 2 + 20)}px" data-t>${fmt(b.time)}</div>` : ''}<span class="rd-dot" style="left:${r1((bw - 24 - dot) / 2)}px;top:${r1(roadY - dot / 2)}px;width:${dot}px;height:${dot}px">${ic(b.icon ?? 'circle', 48)}</span><div class="rd-text" style="top:${r1(roadY + dot / 2 + 24)}px" data-t>${fmt(b.text)}</div></div>`;
		}).join('');
		let goal = '';
		const gx = W - ow + 36;
		if (o) {
			goal = `<div class="rd-goal t-${tone}" style="left:${r1(gx)}px;width:${r1(ow - 36)}px;height:${H}px"><div class="sx-time rd-time" style="bottom:${r1(H - roadY + cap / 2 + 20)}px" data-t>${fmt(o.label ?? 'Outcome')}</div><div class="rd-cap" style="top:${r1(roadY - cap / 2)}px;height:${cap}px" data-fit><span class="rd-value" data-t data-autofit="${Math.round(ow - 36 - 70)}">${fmt(o.value ?? '')}</span></div>${o.text ? `<div class="rd-text big" style="top:${r1(roadY + cap / 2 + 24)}px" data-t>${fmt(o.text)}</div>` : ''}</div>`;
		}
		const x0 = bw / 2, x1 = o ? gx - 14 : W - bw / 2;
		const lastX = bw * (n - 1) + bw / 2;
		const svg = `<svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="M ${r1(x0)} ${roadY} H ${r1(lastX)}" stroke="var(--connector)" stroke-width="8" stroke-linecap="round"/>${o ? `<path d="M ${r1(lastX)} ${roadY} H ${r1(x1)}" stroke="var(--${tone})" stroke-width="8" stroke-linecap="round"/>${arrowHead(x1, roadY, lastX, roadY, `var(--${tone})`, 8)}` : ''}</svg>`;
		return heading(s) + body(`<div class="sx sx-road" style="height:${H}px">${storyWho(s, 'left:0;top:0')}${svg}${stops}${goal}</div>`, { vcenter: false });
	},

	/** The number is the hero, in a big disc; the beats sit around it and point into it. */
	number(s) {
		const H = bodyHeight(s);
		const o = s.outcome;
		const tone = o?.tone ?? 'blue';
		const n = s.beats.length;
		const top = s.who ? 56 : 0;
		const D = Math.min(H - top - 8, 540);
		const cx = W / 2, cy = top + (H - top) / 2;
		const cw = (W - D) / 2 - 86;
		const leftCount = Math.ceil(n / 2);
		let svg = '';
		const beats = s.beats.map((b, i) => {
			const bt = b.tone ?? 'neutral';
			const left = i < leftCount;
			const k = left ? leftCount : n - leftCount;
			const j = left ? i : i - leftCount;
			const by = top + ((H - top) * (j + 1)) / (k + 1);
			const bx = left ? 0 : W - cw;
			const ex = left ? cw + 18 : W - cw - 18;
			const ang = Math.atan2(cy - by, cx - ex);
			const tx = cx - Math.cos(ang) * (D / 2 + 14), ty = cy - Math.sin(ang) * (D / 2 + 14);
			svg += `<path d="M ${r1(ex)} ${r1(by)} L ${r1(tx)} ${r1(ty)}" stroke="var(--connector)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>${arrowHead(tx, ty, ex, by, 'var(--connector)', 3)}`;
			return `<div class="nm-beat t-${bt}${left ? '' : ' right'}" style="left:${r1(bx)}px;top:${r1(by)}px;width:${r1(cw)}px"><span class="nm-icon">${ic(b.icon ?? 'circle', 34)}<span class="st-badge nm-n" data-t>${i + 1}</span></span><div>${b.time ? `<div class="sx-time" data-t>${fmt(b.time)}</div>` : ''}<div class="nm-text" data-t>${fmt(b.text)}</div></div></div>`;
		}).join('');
		const disc = o ? `<div class="nm-disc t-${tone}" style="left:${r1(cx - D / 2)}px;top:${r1(cy - D / 2)}px;width:${D}px;height:${D}px"><div class="sx-time" data-t>${fmt(o.label ?? 'Outcome')}</div><div class="nm-value" data-t data-autofit="${D - 90}">${fmt(o.value ?? '')}</div>${o.text ? `<div class="nm-sub" style="max-width:${D - 130}px" data-t>${fmt(o.text)}</div>` : ''}</div>` : '';
		return heading(s) + body(`<div class="sx sx-number" style="height:${H}px">${storyWho(s, 'left:0;right:0;top:0;justify-content:center')}<svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${disc}${beats}</div>`, { vcenter: false });
	},

	/** A comic strip: one tall panel per beat, the outcome in the last panel in full colour. */
	panels(s) {
		const H = bodyHeight(s);
		const o = s.outcome;
		const tone = o?.tone ?? 'blue';
		const count = s.beats.length + (o ? 1 : 0);
		const gap = 22;
		const top = s.who ? 60 : 0;
		const pw = (W - gap * (count - 1)) / count;
		const panel = (i, inner, cls) => `<div class="pn ${cls}" style="left:${r1(i * (pw + gap))}px;top:${top}px;width:${r1(pw)}px;height:${H - top}px" data-fit>${inner}</div>`;
		const beats = s.beats.map((b, i) => {
			const bt = b.tone && b.tone !== 'neutral' ? b.tone : 'blue';
			return panel(i, `<div class="pn-top"><span class="st-badge pn-n" data-t>${i + 1}</span>${b.time ? `<span class="sx-time" data-t>${fmt(b.time)}</span>` : ''}</div><span class="pn-icon">${ic(b.icon ?? 'circle', 58)}</span><div class="pn-text" data-t>${fmt(b.text)}</div>`, `t-${bt}`);
		}).join('');
		const goal = o ? panel(s.beats.length, `<div class="pn-top"><span class="sx-time" data-t>${fmt(o.label ?? 'Outcome')}</span></div><div class="pn-value" data-t data-autofit="${Math.round(pw - 64)}">${fmt(o.value ?? '')}</div>${o.text ? `<div class="pn-text" data-t>${fmt(o.text)}</div>` : ''}`, `goal t-${tone}`) : '';
		return heading(s) + body(`<div class="sx sx-panels" style="height:${H}px">${storyWho(s, 'left:0;top:0')}${beats}${goal}</div>`, { vcenter: false });
	},

	/** Before and after: the page in two halves, the problem on the left, the fix and the outcome on the right.
	 * Beats go left until the first beat with side: 'after' (default: the second half goes right). before/after: labels. */
	split(s) {
		const H = bodyHeight(s);
		const o = s.outcome;
		const n = s.beats.length;
		const cut = s.beats.findIndex(b => b.side === 'after');
		const k = cut >= 0 ? cut : Math.ceil(n / 2);
		const top = s.who ? 60 : 0;
		const mid = 130;
		const hw = (W - mid) / 2;
		const rows = list => `<div class="sp-beats">${list.map(b => `<div class="sp-beat">${iconTile(b.icon ?? 'circle', { tone: b.tone ?? 'neutral', size: 76, round: true })}<div>${b.time ? `<div class="sx-time" data-t>${fmt(b.time)}</div>` : ''}<div class="sp-text" data-t>${fmt(b.text)}</div></div></div>`).join('')}</div>`;
		const beforeTone = s.beforeTone ?? 'red', afterTone = s.afterTone ?? o?.tone ?? 'green';
		const goal = o ? `<div class="sp-goal"><div class="sx-time" data-t>${fmt(o.label ?? 'Outcome')}</div><div class="sp-value" data-t data-autofit="${Math.round(hw - 100)}">${fmt(o.value ?? '')}</div>${o.text ? `<div class="sp-sub" data-t>${fmt(o.text)}</div>` : ''}</div>` : '';
		const side = (cls, tone, label, inner, left) => `<div class="sp-side ${cls} t-${tone}" style="left:${r1(left)}px;top:${top}px;width:${r1(hw)}px;height:${H - top}px" data-fit><div class="sp-head" data-t>${fmt(label)}</div>${inner}</div>`;
		const arrow = `<span class="sp-arrow t-${afterTone}" style="left:${r1(W / 2 - 46)}px;top:${r1(top + (H - top) / 2 - 46)}px">${ic('arrowRight', 44)}</span>`;
		return heading(s) + body(`<div class="sx sx-split" style="height:${H}px">${storyWho(s, 'left:0;top:0')}${side('before', beforeTone, s.before ?? 'Before', rows(s.beats.slice(0, k)), 0)}${side('after', afterTone, s.after ?? 'After', rows(s.beats.slice(k)) + goal, W - hw)}${arrow}</div>`, { vcenter: false });
	},
};

export const DIAGRAMS = {
	/** A request branching into what the agent could do. Your words cut some branches; the rest stays open.
	 * root: { label, text, icon }, branches (3-6): [{ text, cut: 'the words that cut it' }] (list the open ones last),
	 * keepLabel: label for the open branches, cutLabel: label over the cut words. */
	tree(s) {
		const H = bodyHeight(s);
		const n = s.branches.length;
		const rootW = 420, rootH = s.root.label ? 176 : 136;
		const leafX = 820, leafW = 410, leafH = 76;
		const whyX = leafX + leafW + 40;
		const gap = Math.min(34, (H - 60 - n * leafH) / Math.max(1, n - 1));
		const total = n * leafH + (n - 1) * gap;
		const top0 = (H - total) / 2 + (s.cutLabel ? 24 : 0);
		const ry = H / 2;
		let svg = '';
		let html = `<div class="tree-root" data-fit style="left:0;top:${r1(ry - rootH / 2)}px;width:${rootW}px;height:${rootH}px">${s.root.label ? `<div class="lbl" data-t>${fmt(s.root.label)}</div>` : ''}<div class="tree-root-text" data-t>${fmt(s.root.text)}</div></div>`;
		const open = [];
		s.branches.forEach((b, i) => {
			const y = top0 + i * (leafH + gap) + leafH / 2;
			const cut = !!b.cut;
			const p0 = { x: rootW, y: ry }, p1 = { x: rootW + 200, y: ry }, p2 = { x: leafX - 200, y }, p3 = { x: leafX, y };
			svg += `<path d="M ${p0.x} ${r1(p0.y)} C ${p1.x} ${r1(p1.y)}, ${p2.x} ${r1(p2.y)}, ${p3.x} ${r1(p3.y)}" fill="none" stroke="${cut ? 'var(--faint)' : 'var(--green)'}" stroke-width="${cut ? 3 : 4}"${cut ? ' stroke-dasharray="3 11"' : ''} stroke-linecap="round"/>`;
			if (cut) {
				const at = bezier(p0, p1, p2, p3, 0.8);
				html += `<span class="tree-scissors" style="left:${r1(at.x)}px;top:${r1(at.y)}px">${ic('cut', 26)}</span>`;
				html += `<div class="tree-why" style="left:${whyX}px;top:${r1(y)}px">${pill({ text: b.cut, tone: 'red', icon: 'cut', size: 'm' })}</div>`;
			} else {
				open.push(y);
			}
			html += `<div class="tree-leaf${cut ? ' cut' : ''}" data-fit style="left:${leafX}px;top:${r1(y - leafH / 2)}px;width:${leafW}px;height:${leafH}px">${ic(cut ? 'dismiss' : 'sparkle', 28)}<span data-t>${fmt(b.text)}</span></div>`;
		});
		if (open.length && s.keepLabel) {
			const y0 = Math.min(...open) - leafH / 2 + 8, y1 = Math.max(...open) + leafH / 2 - 8;
			svg += `<path d="M ${whyX} ${r1(y0)} h 16 V ${r1(y1)} h -16" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
			html += `<div class="tree-keep" style="left:${whyX + 38}px;top:${r1((y0 + y1) / 2)}px">${pill({ text: s.keepLabel, tone: 'green', icon: 'sparkle', size: 'm' })}</div>`;
		}
		if (s.cutLabel) {
			html += `<div class="tree-cutlabel lbl" data-t style="left:${whyX}px;top:${r1(top0 - 46)}px;color:var(--red)">${fmt(s.cutLabel)}</div>`;
		}
		return heading(s) + body(`<div class="tree" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** A scale between two extremes, with the good zone marked.
	 * left/right: { title, text, icon, tone }, zone: { from, to (0..1), title, text, tone }, marks: [{ at, label, tone }] */
	spectrum(s) {
		const H = bodyHeight(s);
		const ty = Math.round(H * 0.5);
		const lt = `var(--${s.left.tone ?? 'orange'})`, rt = `var(--${s.right.tone ?? 'orange'})`;
		let svg = `<defs><linearGradient id="spec-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${lt}" stop-opacity=".45"/><stop offset=".3" stop-color="#eef0f3"/><stop offset=".7" stop-color="#eef0f3"/><stop offset="1" stop-color="${rt}" stop-opacity=".45"/></linearGradient></defs><rect x="18" y="${ty - 9}" width="${W - 36}" height="18" rx="9" fill="url(#spec-g)"/>`;
		svg += arrowHead(6, ty, 40, ty, 'var(--line-strong)', 4) + arrowHead(W - 6, ty, W - 40, ty, 'var(--line-strong)', 4);
		let html = '';
		const end = (e, side) => {
			const tone = e.tone ?? 'orange';
			const align = side === 'left' ? 'left:0;align-items:flex-start;text-align:left' : 'right:0;align-items:flex-end;text-align:right';
			html += `<div class="spec-end t-${tone}" style="${align};bottom:${H - ty + 40}px">${e.icon ? iconTile(e.icon, { tone, size: 60 }) : ''}<div class="spec-title" data-t>${fmt(e.title)}</div></div>`;
			if (e.text) {
				html += `<div class="spec-text" data-t style="${side === 'left' ? 'left:0;text-align:left' : 'right:0;text-align:right'};top:${ty + 40}px">${fmt(e.text)}</div>`;
			}
		};
		end(s.left, 'left');
		end(s.right, 'right');
		if (s.zone) {
			const z = s.zone;
			const tone = z.tone ?? 'green';
			const x0 = z.from * W, x1 = z.to * W, cx = (x0 + x1) / 2;
			svg += `<rect x="${r1(x0)}" y="${ty - 24}" width="${r1(x1 - x0)}" height="48" rx="24" fill="var(--${tone}-tint)" stroke="var(--${tone})" stroke-width="3"/>`;
			html += `<div class="spec-zone" style="left:${r1(cx)}px;bottom:${H - ty + 44}px">${pill({ text: z.title, tone, icon: z.icon ?? 'target', size: 'l', solid: true })}</div>`;
			if (z.text) {
				html += `<div class="spec-zone-text t-${tone}" data-fit style="left:${r1(cx)}px;top:${ty + 44}px"><span data-t>${fmt(z.text)}</span></div>`;
			}
		}
		for (const m of s.marks ?? []) {
			const tone = m.tone ?? 'blue';
			html += `<span class="spec-mark t-${tone}" style="left:${r1(m.at * W)}px;top:${ty}px"></span><div class="spec-mark-label t-${tone}" data-t style="left:${r1(m.at * W)}px;top:${ty + 34}px">${fmt(m.label)}</div>`;
		}
		return heading(s) + body(`<div class="spectrum" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;overflow:visible">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** A conversation. messages: [{ from: 'user'|'agent'|'note', text, label, mono, icon, tone }], dark: true for a dark
	 * editor panel, width, callouts (<= 3, numbered on the right). */
	chat(s) {
		const width = s.width ?? (s.callouts?.length ? 1040 : 1240);
		const msgs = s.messages.map(m => {
			if (m.from === 'note') {
				return `<div class="chat-note" data-t>${fmt(m.text)}</div>`;
			}
			const user = m.from === 'user';
			const label = m.label ? `<div class="chat-label" data-t>${fmt(m.label)}</div>` : '';
			const avatar = user ? `<span class="chat-av">${ic('person', 28)}</span>` : iconTile(m.icon ?? 'bot', { tone: m.tone ?? 'purple', size: 52, round: true });
			const bubble = `<div class="chat-bubble${m.mono ? ' mono' : ''}" data-fit>${label}<div class="chat-text" data-t>${m.mono ? esc(m.text) : fmt(m.text)}</div></div>`;
			return `<div class="chat-row ${user ? 'user' : 'agent'}">${user ? bubble + avatar : avatar + bubble}</div>`;
		}).join('');
		const panel = `<div class="chat${s.dark ? ' dark' : ''}" style="width:${width}px">${s.window ? `<div class="chat-bar" data-t>${esc(s.window)}</div>` : ''}<div class="chat-msgs">${msgs}</div></div>`;
		return heading(s) + body(`<div class="ui-wrap${s.callouts?.length ? '' : ' center'}">${panel}${notesList(s.callouts)}</div>`);
	},

	/** A folder tree, with highlighted files explained on the right.
	 * root: folder name, items: [{ path: 'a/b/FILE.md' (end folders with /), title, text, icon, tone }] (an item
	 * without a title is drawn but not explained). */
	files(s) {
		const H = bodyHeight(s);
		const rows = [{ name: s.root ?? 'my-app', depth: 0, folder: true }];
		const seen = new Set();
		for (const it of s.items) {
			const isFolder = it.path.endsWith('/');
			const parts = it.path.replace(/\/$/, '').split('/');
			let acc = '';
			parts.forEach((p, i) => {
				acc += (acc ? '/' : '') + p;
				const last = i === parts.length - 1;
				if (!last || isFolder) {
					if (!seen.has(acc)) {
						seen.add(acc);
						rows.push({ name: p, depth: i + 1, folder: true, item: last ? it : null });
					}
				} else {
					rows.push({ name: p, depth: i + 1, folder: false, item: it });
				}
			});
		}
		const panelW = s.panelWidth ?? 640;
		const barH = 58;
		const rowH = Math.min(56, (H - barH - 28) / rows.length);
		const panelH = barH + rows.length * rowH + 20;
		const panelTop = (H - panelH) / 2;
		const explained = [];
		let k = 0;
		const rowHtml = rows.map((r, i) => {
			const it = r.item;
			const tone = it?.tone ?? (it?.title ? stepTone(k) : null);
			const y = panelTop + barH + i * rowH + rowH / 2;
			let badge = '';
			if (it?.title) {
				explained.push({ it, tone, y, k });
				badge = `<span class="st-badge" style="width:30px;height:30px;font-size:15px;background:var(--fg);margin-left:auto" data-t>${k + 1}</span>`;
				k++;
			}
			return `<div class="fx-row${tone ? ` on t-${tone}` : ''}${it?.dim ? ' dim' : ''}" style="height:${r1(rowH)}px;padding-left:${18 + r.depth * 30}px">${ic(r.folder ? 'folder' : 'document', 26, tone ? 'var(--fg)' : 'var(--muted)')}<span class="fx-name" data-t>${esc(r.name)}${r.folder ? '/' : ''}</span>${badge}</div>`;
		}).join('');
		const panel = `<div class="fx-panel" style="left:0;top:${r1(panelTop)}px;width:${panelW}px;height:${r1(panelH)}px"><div class="fx-bar" style="height:${barH}px"><span class="lbl" data-t>Explorer</span></div>${rowHtml}</div>`;
		// Notes on the right, near their row, pushed apart so they never overlap.
		const noteX = panelW + 120;
		const noteH = s.noteHeight ?? 128;
		const gap = 22;
		const ys = explained.map(e => e.y - noteH / 2);
		for (let i = 1; i < ys.length; i++) {
			ys[i] = Math.max(ys[i], ys[i - 1] + noteH + gap);
		}
		const overflow = ys.length ? ys[ys.length - 1] + noteH - H : 0;
		if (overflow > 0) {
			for (let i = ys.length - 1; i >= 0; i--) {
				ys[i] -= overflow;
				if (i > 0) {
					ys[i - 1] = Math.min(ys[i - 1], ys[i] - noteH - gap);
				}
			}
		}
		let svg = '';
		let notes = '';
		explained.forEach((e, i) => {
			const ny = Math.max(0, ys[i]);
			const cy = ny + noteH / 2;
			svg += `<path d="M ${panelW + 6} ${r1(e.y)} C ${panelW + 66} ${r1(e.y)}, ${noteX - 66} ${r1(cy)}, ${noteX - 8} ${r1(cy)}" fill="none" stroke="var(--${e.tone})" stroke-width="3" stroke-linecap="round"/><circle cx="${panelW + 6}" cy="${r1(e.y)}" r="6" fill="var(--${e.tone})"/>`;
			notes += `<div class="fx-note t-${e.tone}" data-fit style="left:${noteX}px;top:${r1(ny)}px;width:${W - noteX}px;height:${noteH}px">${iconTile(e.it.icon ?? 'document', { tone: e.tone, size: 60 })}<div><div class="t" data-t>${fmt(e.it.title)}</div>${e.it.text ? `<div class="s" data-t>${fmt(e.it.text)}</div>` : ''}</div></div>`;
		});
		return heading(s) + body(`<div class="files" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${svg}</svg>${panel}${notes}</div>`, { vcenter: false });
	},

	/** A loop of 3-6 steps around a circle. steps: [{ icon, title, sub, tone }], center: { title, icon },
	 * aside: { label, title, text } (a card on the right). */
	cycle(s) {
		const H = bodyHeight(s);
		const n = s.steps.length;
		const node = 92;
		const labelH = s.steps.some(st => st.sub) ? 80 : 44;
		const r = Math.min(s.radius ?? 230, (H - 2 * (node / 2 + 18 + labelH)) / 2);
		const cx = s.aside ? 640 : W / 2, cy = H / 2;
		const lw = s.aside ? 270 : 330;
		const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;
		const pt = a => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
		let svg = '';
		let html = '';
		const gapA = (node / 2 + 16) / r;
		for (let i = 0; i < n; i++) {
			const a0 = ang(i) + gapA, a1 = ang(i + 1) - gapA;
			const p0 = pt(a0), p1 = pt(a1);
			const before = pt(a1 - 0.08);
			svg += `<path d="M ${r1(p0.x)} ${r1(p0.y)} A ${r1(r)} ${r1(r)} 0 0 1 ${r1(p1.x)} ${r1(p1.y)}" fill="none" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/>${arrowHead(p1.x, p1.y, before.x, before.y, 'var(--connector)', 4)}`;
		}
		s.steps.forEach((st, i) => {
			const tone = st.tone ?? stepTone(i);
			const a = ang(i);
			const p = pt(a);
			html += `<span class="cy-node t-${tone}" style="left:${r1(p.x)}px;top:${r1(p.y)}px;width:${node}px;height:${node}px">${ic(st.icon ?? 'circle', 44)}</span>`;
			const c = Math.cos(a), sn = Math.sin(a);
			let style;
			if (Math.abs(c) < 0.35) {
				const ly = sn < 0 ? p.y - node / 2 - 14 - labelH : p.y + node / 2 + 14;
				style = `left:${r1(p.x - lw / 2)}px;top:${r1(ly)}px;width:${lw}px;text-align:center`;
			} else if (c > 0) {
				style = `left:${r1(p.x + node / 2 + 20)}px;top:${r1(p.y - labelH / 2)}px;width:${lw}px;text-align:left`;
			} else {
				style = `left:${r1(p.x - node / 2 - 20 - lw)}px;top:${r1(p.y - labelH / 2)}px;width:${lw}px;text-align:right`;
			}
			html += `<div class="cy-label t-${tone}" style="${style};height:${labelH}px"><div class="t" data-t>${fmt(st.title)}</div>${st.sub ? `<div class="s" data-t>${fmt(st.sub)}</div>` : ''}</div>`;
		});
		if (s.center) {
			html += `<div class="cy-center" style="left:${r1(cx)}px;top:${r1(cy)}px;width:${r1(Math.min(300, 2 * r - node - 48))}px">${s.center.icon ? ic(s.center.icon, 40, 'var(--blue)') : ''}<div data-t>${fmt(s.center.title)}</div></div>`;
		}
		let aside = '';
		if (s.aside) {
			const a = s.aside;
			aside = `<div class="st-card cy-aside" data-fit style="left:1240px;width:${W - 1240}px">${a.label ? `<div class="lbl" style="color:var(--blue)" data-t>${fmt(a.label)}</div>` : ''}${a.title ? `<div class="aside-title" data-t>${fmt(a.title)}</div>` : ''}${a.text ? `<div class="aside-body" data-t>${fmt(a.text)}</div>` : ''}</div>`;
		}
		return heading(s) + body(`<div class="cycle" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${svg}</svg>${html}${aside}</div>`, { vcenter: false });
	},

	/** Boxes and arrows on a grid, with yes/no branches. nodes: [{ id, col, row, title, sub, icon, tone, kind: 'decision' }],
	 * edges: [{ from, to, label, bend: 'below'|'above', tone, dashed }], cols, rows, boxWidth, boxHeight. */
	flow(s) {
		const H = bodyHeight(s);
		const C = s.cols ?? Math.max(...s.nodes.map(nd => nd.col)) + 1;
		const R = s.rows ?? Math.max(...s.nodes.map(nd => nd.row)) + 1;
		const cw = W / C, rh = H / R;
		const bw = Math.min(s.boxWidth ?? 390, cw - 64);
		const bh = s.boxHeight ?? (R >= 3 ? 150 : 170);
		const pos = new Map(s.nodes.map(nd => [nd.id, { x: (nd.col + 0.5) * cw, y: (nd.row + 0.5) * rh }]));
		const clip = (c, tx, ty, pad) => {
			const dx = tx - c.x, dy = ty - c.y;
			const kx = dx === 0 ? Infinity : (bw / 2 + pad) / Math.abs(dx);
			const ky = dy === 0 ? Infinity : (bh / 2 + pad) / Math.abs(dy);
			const k = Math.min(kx, ky);
			return { x: c.x + dx * k, y: c.y + dy * k };
		};
		let svg = '';
		let html = '';
		for (const e of s.edges) {
			const a = pos.get(e.from), b = pos.get(e.to);
			if (!a || !b) {
				throw new Error(`flow: unknown node in edge ${e.from} -> ${e.to}`);
			}
			const color = `var(--${e.tone ?? 'connector'})`;
			const dash = e.dashed ? ' stroke-dasharray="8 10"' : '';
			let mid;
			if (e.bend) {
				const amount = e.bendAmount ?? rh * 0.55;
				const off = { below: [0, amount], above: [0, -amount], left: [-amount, 0], right: [amount, 0] }[e.bend];
				const c = { x: (a.x + b.x) / 2 + off[0], y: Math.min(H - 8, Math.max(8, (a.y + b.y) / 2 + off[1])) };
				const p0 = clip(a, c.x, c.y, 6), p1 = clip(b, c.x, c.y, 14);
				svg += `<path d="M ${r1(p0.x)} ${r1(p0.y)} Q ${r1(c.x)} ${r1(c.y)} ${r1(p1.x)} ${r1(p1.y)}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"${dash}/>${arrowHead(p1.x, p1.y, c.x, c.y, color, 3.5)}`;
				mid = { x: 0.25 * p0.x + 0.5 * c.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * c.y + 0.25 * p1.y };
			} else {
				const p0 = clip(a, b.x, b.y, 6), p1 = clip(b, a.x, a.y, 14);
				svg += `<path d="M ${r1(p0.x)} ${r1(p0.y)} L ${r1(p1.x)} ${r1(p1.y)}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"${dash}/>${arrowHead(p1.x, p1.y, p0.x, p0.y, color, 3.5)}`;
				mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
			}
			if (e.label) {
				html += `<div class="flow-label${e.tone ? ` t-${e.tone}` : ''}" data-t style="left:${r1(mid.x)}px;top:${r1(mid.y)}px">${fmt(e.label)}</div>`;
			}
		}
		for (const nd of s.nodes) {
			const p = pos.get(nd.id);
			const tone = nd.tone ?? (nd.kind === 'decision' ? 'orange' : 'blue');
			html += `<div class="flow-node t-${tone}${nd.kind === 'decision' ? ' decision' : ''}${nd.on ? ' on' : ''}" data-fit style="left:${r1(p.x - bw / 2)}px;top:${r1(p.y - bh / 2)}px;width:${r1(bw)}px;height:${bh}px">${iconTile(nd.icon ?? (nd.kind === 'decision' ? 'question' : 'circle'), { tone, size: 52, round: nd.kind === 'decision' })}<div><div class="t" data-t>${fmt(nd.title)}</div>${nd.sub ? `<div class="s" data-t>${fmt(nd.sub)}</div>` : ''}</div></div>`;
		}
		return heading(s) + body(`<div class="flow" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;overflow:visible">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** A bar chart. bars: [{ label, value, text, tone, on }], unit, max, horizontal: true for long labels, note. */
	bars(s) {
		const H = bodyHeight(s) - (s.note ? 64 : 0);
		const n = s.bars.length;
		const max = s.max ?? Math.max(...s.bars.map(b => b.value));
		const valueText = b => b.text ?? `${b.value}${s.unit ?? ''}`;
		let html = '';
		if (s.horizontal) {
			const rowH = Math.min(96, H / n);
			const labelW = s.labelWidth ?? 440, valueW = 170;
			const trackW = W - labelW - valueW - 48;
			const top = (H - rowH * n) / 2;
			s.bars.forEach((b, i) => {
				const tone = b.tone ?? (b.on ? 'blue' : null);
				const y = top + i * rowH;
				const bw = Math.max(6, (b.value / max) * trackW);
				html += `<div class="bar-hlabel" data-t style="top:${r1(y)}px;height:${r1(rowH)}px;width:${labelW}px">${fmt(b.label)}</div>`;
				html += `<div class="bar-h${tone ? ` on t-${tone}` : ''}" style="left:${labelW + 24}px;top:${r1(y + rowH * 0.2)}px;width:${r1(bw)}px;height:${r1(rowH * 0.6)}px"></div>`;
				html += `<div class="bar-hvalue${tone ? ` t-${tone}` : ''}" data-t style="left:${r1(labelW + 24 + bw + 18)}px;top:${r1(y)}px;height:${r1(rowH)}px">${fmt(valueText(b))}</div>`;
			});
		} else {
			const labelH = 76, valueH = 64;
			const chartH = H - labelH - valueH;
			const slot = W / n;
			const bw = Math.min(s.barWidth ?? 156, slot * 0.62);
			s.bars.forEach((b, i) => {
				const tone = b.tone ?? (b.on ? 'blue' : null);
				const h = Math.max(4, (b.value / max) * chartH);
				const x = i * slot + (slot - bw) / 2;
				const y = valueH + chartH - h;
				html += `<div class="bar-v${tone ? ` on t-${tone}` : ''}" style="left:${r1(x)}px;top:${r1(y)}px;width:${r1(bw)}px;height:${r1(h)}px"></div>`;
				html += `<div class="bar-value${tone ? ` t-${tone}` : ''}" data-t style="left:${r1(i * slot + slot / 2)}px;top:${r1(y - 56)}px">${fmt(valueText(b))}</div>`;
				html += `<div class="bar-label" data-t style="left:${r1(i * slot + 6)}px;top:${r1(valueH + chartH + 16)}px;width:${r1(slot - 12)}px">${fmt(b.label)}</div>`;
			});
			html += `<div class="bar-base" style="top:${valueH + chartH}px"></div>`;
		}
		return heading(s) + body(`<div class="bars" style="height:${H}px">${html}</div>${s.note ? `<div class="counters-note" data-t>${fmt(s.note)}</div>` : ''}`, { vcenter: false });
	},

	/** Narrowing stages with numbers. stages (2-5): [{ value, label, tone }], note. */
	funnel(s) {
		const H = bodyHeight(s) - (s.note ? 64 : 0);
		const n = s.stages.length;
		const gap = 14;
		const bh = (H - gap * (n - 1)) / n;
		const topW = s.topWidth ?? 1560, botW = s.bottomWidth ?? 620;
		const wAt = y => topW - (topW - botW) * (y / H);
		let svg = '';
		let html = '';
		s.stages.forEach((st, i) => {
			const tone = st.tone ?? (i === n - 1 ? 'red' : 'neutral');
			const y0 = i * (bh + gap), y1 = y0 + bh;
			const w0 = wAt(y0), w1 = wAt(y1);
			svg += `<polygon points="${r1(W / 2 - w0 / 2)},${r1(y0)} ${r1(W / 2 + w0 / 2)},${r1(y0)} ${r1(W / 2 + w1 / 2)},${r1(y1)} ${r1(W / 2 - w1 / 2)},${r1(y1)}" fill="var(--${tone}-tint)" stroke="var(--${tone === 'neutral' ? 'line-strong' : tone})" stroke-width="2.5" stroke-linejoin="round"/>`;
			html += `<div class="fn-stage t-${tone}" data-fit style="left:${r1(W / 2 - w1 / 2 + 20)}px;top:${r1(y0)}px;width:${r1(w1 - 40)}px;height:${r1(bh)}px"><span class="fn-value" data-t>${fmt(st.value)}</span><span class="fn-label" data-t>${fmt(st.label)}</span></div>`;
		});
		return heading(s) + body(`<div class="funnel" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${svg}</svg>${html}</div>${s.note ? `<div class="counters-note" data-t>${fmt(s.note)}</div>` : ''}`, { vcenter: false });
	},

	/** One giant number or word, with an optional brand logo. logo: slug in deck/theme/logos, logoText, icon, value, label,
	 * sub (a pill under it), subTone, tone, align: 'left'. Use bg: 'dark' | 'blue' on the slide for a full-colour page. */
	hero(s) {
		const tone = s.tone ?? 'blue';
		let mark = '';
		if (s.logo) {
			mark = `<div class="hero-logo">${logo(s.logo, s.logoSize ?? 112, s.bg === 'dark' || s.bg === 'blue' ? '#ffffff' : null)}${s.logoText ? `<span class="hero-logo-text" data-t style="color:${s.bg === 'dark' || s.bg === 'blue' ? '#ffffff' : LOGOS[s.logo].hex}">${esc(s.logoText)}</span>` : ''}</div>`;
		} else if (s.icon) {
			mark = `<div class="hero-logo">${iconTile(s.icon, { tone, size: 120 })}</div>`;
		}
		const value = s.value ? `<div class="hero-value t-${tone}" data-t data-autofit="${W}">${fmt(s.value)}</div>` : '';
		const label = s.label ? `<div class="hero-label" data-t>${fmt(s.label)}</div>` : '';
		const sub = s.sub ? `<div class="hero-sub">${pill({ text: s.sub, tone: s.subTone ?? 'red', icon: s.subIcon ?? 'warning', size: 'l', white: s.bg === 'dark' || s.bg === 'blue' })}</div>` : '';
		const inner = `<div class="hero${s.align === 'left' ? ' left' : ''}">${mark}${value}${label}${sub}</div>`;
		if (s.title) {
			return heading(s) + body(inner);
		}
		return body(`${s.eyebrow ? `<div class="st-eyebrow hero-eyebrow" data-t>${fmt(s.eyebrow)}</div>` : ''}${inner}`, { full: true });
	},

	/** Two or three overlapping circles. sets: [{ title, sub, tone }], center: { title, icon } (where they meet). */
	venn(s) {
		const H = bodyHeight(s);
		const n = s.sets.length;
		const cy = H / 2;
		let circles;
		if (n === 2) {
			const r = Math.min(300, H / 2 - 16);
			const d = r * 0.6;
			circles = [{ x: W / 2 - d, y: cy, r, lx: W / 2 - d - r * 0.42, ly: cy }, { x: W / 2 + d, y: cy, r, lx: W / 2 + d + r * 0.42, ly: cy }];
		} else {
			const r = Math.min(216, (H - 24) / 3.1);
			const d = r * 0.62;
			const ccy = (H - (1.5 * d + 2 * r)) / 2 + d + r;
			circles = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6].map(a => ({
				x: W / 2 + d * Math.cos(a), y: ccy + d * Math.sin(a), r,
				lx: W / 2 + (d + r * 0.5) * Math.cos(a), ly: ccy + (d + r * 0.5) * Math.sin(a),
			}));
		}
		let svg = '';
		let html = '';
		s.sets.forEach((st, i) => {
			const c = circles[i];
			const tone = st.tone ?? stepTone(i);
			svg += `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${r1(c.r)}" fill="var(--${tone})" fill-opacity=".09" stroke="var(--${tone})" stroke-width="3"/>`;
			html += `<div class="venn-label t-${tone}" style="left:${r1(c.lx)}px;top:${r1(c.ly)}px;width:${r1(c.r * (n === 2 ? 0.9 : 0.86))}px"><div class="t" data-t>${fmt(st.title)}</div>${st.sub ? `<div class="s" data-t>${fmt(st.sub)}</div>` : ''}</div>`;
		});
		if (s.center) {
			const ccx = W / 2, ccy = n === 2 ? cy : circles.reduce((a, c) => a + c.y, 0) / 3;
			html += `<div class="venn-center" style="left:${r1(ccx)}px;top:${r1(ccy)}px">${pill({ text: s.center.title, tone: s.center.tone ?? 'blue', icon: s.center.icon, solid: true, size: 'l' })}</div>`;
		}
		return heading(s) + body(`<div class="venn" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** What one thing keeps across its life: moments left to right, a row per piece of state, a bar while it holds (a
	 * lifecycle, ownership that ends while identity stays). moments: [{ title (<= 18), sub (<= 24) }] (3-5),
	 * rows: [{ title (<= 20), tone, bars: [{ from, to (moment indexes), text (<= 26), tone, solid }] }] (2-5), labelWidth. */
	spans(s) {
		const H = bodyHeight(s);
		const labelW = s.labelWidth ?? 330;
		const x0 = labelW + 130, x1 = W - 175;
		const n = s.moments.length;
		const mx = i => x0 + (i * (x1 - x0)) / (n - 1);
		const headH = 124;
		const rowH = s.rowHeight ?? Math.min(130, Math.max(96, (H - headH - 20) / s.rows.length));
		const barH = Math.round(rowH * 0.55);
		const total = headH + s.rows.length * rowH;
		const y0 = Math.max(0, Math.round((H - total) / 2));
		const axisY = y0 + headH - 20;
		const bottom = y0 + total;
		let svg = `<path d="M ${r1(mx(0) - 50)} ${axisY} H ${r1(mx(n - 1) + 50)}" stroke="var(--connector)" stroke-width="3" stroke-linecap="round"/>`;
		let html = '';
		s.moments.forEach((m, i) => {
			svg += `<path d="M ${r1(mx(i))} ${axisY} V ${bottom}" stroke="var(--connector)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>`;
			html += `<div class="sp-moment" style="left:${r1(mx(i))}px;top:${y0}px" data-fit><div class="sp-mt" data-t>${fmt(m.title)}</div>${m.sub ? `<div class="sp-ms" data-t>${fmt(m.sub)}</div>` : ''}</div>`;
			html += `<span class="sp-dot" style="left:${r1(mx(i))}px;top:${axisY}px"></span>`;
		});
		s.rows.forEach((row, r) => {
			const y = y0 + headH + r * rowH;
			html += `<div class="sp-row" style="top:${r1(y)}px;width:${labelW}px;height:${r1(rowH)}px" data-fit><div class="sp-rt" data-t>${fmt(row.title)}</div></div>`;
			for (const b of row.bars ?? []) {
				if (!(b.from >= 0 && b.to < n && b.to > b.from)) {
					throw new Error(`spans: a bar of "${row.title}" runs from ${b.from} to ${b.to}; moments are 0 to ${n - 1}`);
				}
				const left = mx(b.from), right = mx(b.to);
				html += `<div class="sp-bar t-${b.tone ?? row.tone ?? 'blue'}${b.solid ? ' sp-solid' : ''}" style="left:${r1(left)}px;top:${r1(y + (rowH - barH) / 2)}px;width:${r1(right - left)}px;height:${barH}px" data-fit>${b.text ? `<span data-t>${fmt(b.text)}</span>` : ''}</div>`;
			}
		});
		return heading(s) + body(`<div class="spans" style="width:${W}px;height:${H}px"><svg class="sp-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** Pictures: 1-6 frames (screenshots, video stills, renders) with captions, or groups of stacked strips.
	 * items: [{ src, alt, caption, sub, kind: 'image'|'video'|'website'|'motion'|'cad'|'svg', fit: 'cover'|'contain', placeholder }],
	 * cols, height, groups: [{ title, tone, icon, items: [{ src, alt }] }] (stacked at one scale, e.g. chat lines). */
	media(s) {
		const H = bodyHeight(s);
		const rel = htmlRef;
		const KIND_ICON = { image: 'image', video: 'videoClip', website: 'globe', motion: 'film', cad: 'cube', svg: 'shapes' };
		const frame = (it, w, h, fit) => {
			const file = it.src ? deckFile(it.src) : null;
			const play = it.kind === 'video' || it.kind === 'motion' ? `<span class="md-play">${ic('play', 44)}</span>` : '';
			if (file && fs.existsSync(file)) {
				return `<div class="md-frame" style="width:${r1(w)}px;height:${r1(h)}px"><img src="${rel(file)}" alt="${esc(it.alt ?? '')}" style="object-fit:${it.fit ?? fit}">${play}</div>`;
			}
			return `<div class="md-frame missing" data-missing="${esc(it.src ?? '')}" style="width:${r1(w)}px;height:${r1(h)}px"><div class="ph">${ic(KIND_ICON[it.kind] ?? 'image', 64, 'var(--faint)')}<div data-t>${fmt(it.placeholder ?? it.alt ?? it.caption ?? 'Picture')}</div></div></div>`;
		};
		if (s.groups) {
			const headH = 56, headGap = 14, itemGap = 14, groupGap = 30;
			const sizes = s.groups.map(g => g.items.map(it => {
				const file = deckFile(it.src);
				return fs.existsSync(file) ? pngSize(file) : { width: 2400, height: 200 };
			}));
			const fixed = s.groups.reduce((a, g) => a + headH + headGap + itemGap * (g.items.length - 1), 0) + groupGap * (s.groups.length - 1);
			const sumH = sizes.flat().reduce((a, z) => a + z.height, 0);
			const maxW = Math.max(...sizes.flat().map(z => z.width));
			const k = Math.min(s.scale ?? 0.62, (H - fixed) / sumH, W / maxW);
			const groups = s.groups.map((g, gi) => {
				const tone = g.tone ?? stepTone(gi);
				const items = g.items.map((it, ii) => {
					const z = sizes[gi][ii];
					return frame(it, z.width * k, z.height * k, 'cover');
				}).join('');
				return `<div class="md-group" style="gap:${itemGap}px"><div style="height:${headH}px;display:flex;align-items:center">${pill({ text: g.title, tone, icon: g.icon, size: 'l' })}</div>${items}</div>`;
			}).join('');
			return heading(s) + body(`<div class="md-stack" style="gap:${groupGap}px">${groups}</div>`);
		}
		const n = s.items.length;
		const cols = s.cols ?? (n <= 3 ? n : n === 4 ? 2 : 3);
		const rows = Math.ceil(n / cols);
		const gap = 30;
		const capH = s.items.some(it => it.caption) ? (s.items.some(it => it.sub) ? 92 : 54) : 0;
		const cellW = (W - gap * (cols - 1)) / cols;
		const frameH = Math.min(s.height ?? Infinity, (H - rows * capH - gap * (rows - 1)) / rows);
		const frameW = n === 1 ? Math.min(W, s.width ?? frameH * (s.aspect ?? 16 / 9)) : cellW;
		const cells = s.items.map(it => `<figure class="md-cell" style="width:${r1(frameW)}px">${frame(it, frameW, frameH, n === 1 ? 'contain' : 'cover')}${it.caption ? `<figcaption style="height:${capH}px"><div class="t" data-t>${fmt(it.caption)}</div>${it.sub ? `<div class="s" data-t>${fmt(it.sub)}</div>` : ''}</figcaption>` : ''}</figure>`).join('');
		return heading(s) + body(`<div class="md-grid" style="gap:${gap}px;max-width:${r1(cols * frameW + (cols - 1) * gap + 1)}px">${cells}</div>`);
	},

	/** A terminal with commands and their output. lines: [{ cmd } | { out, tone } | { comment }], window, width, fontSize,
	 * callouts (<= 3). */
	terminal(s) {
		const width = s.width ?? (s.callouts?.length ? 1080 : 1360);
		const lines = s.lines.map(l => {
			if (l.cmd !== undefined) {
				return `<div class="tx-line cmd"><span class="tx-ps">${esc(l.prompt ?? '$')}</span><span data-t>${esc(l.cmd)}</span></div>`;
			}
			if (l.comment !== undefined) {
				return `<div class="tx-line comment" data-t># ${esc(l.comment)}</div>`;
			}
			return `<div class="tx-line out${l.tone ? ` t-${l.tone}` : ''}" data-t>${esc(l.out ?? '')}</div>`;
		}).join('');
		const win = `<div class="txwin" data-fit style="width:${width}px"><div class="tx-bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="wt" data-t>${esc(s.window ?? 'Terminal')}</span></div><div class="tx-body" style="font-size:${s.fontSize ?? 26}px">${lines}</div></div>`;
		return heading(s) + body(`<div class="ui-wrap${s.callouts?.length ? '' : ' center'}">${win}${notesList(s.callouts)}</div>`);
	},

	/** What happened: a real event told in 3-5 beats on a timeline, with the outcome on the right. Use it BEFORE the slide
	 * that draws the lesson, so nobody has to know the story already.
	 * who: { icon, text } (who it happened to), beats (3-5): [{ time, text (<= 14 words), icon, tone }],
	 * outcome: { label (small caps, default 'Outcome'), value (big, <= 7 chars), text (<= 16 words), pill, pillTone, tone }.
	 * look: 'road' | 'number' | 'panels' | 'split' draws the same story full page (see STORY_LOOKS); no look = the classic
	 * list with the outcome on the right. */
	story(s) {
		if (s.look) {
			if (!STORY_LOOKS[s.look]) {
				throw new Error(`Unknown story look "${s.look}" on ${s.id}. Known looks: ${Object.keys(STORY_LOOKS).join(', ')}`);
			}
			return STORY_LOOKS[s.look](s);
		}
		const tone = s.outcome?.tone ?? 'red';
		const who = s.who ? `<div class="story-who">${pill({ text: s.who.text, icon: s.who.icon ?? 'building', tone: 'neutral', size: 'm' })}</div>` : '';
		const beats = s.beats.map((b, i) => {
			const bt = b.tone ?? (i === s.beats.length - 1 ? tone : 'neutral');
			return `<div class="beat t-${bt}"><span class="beat-dot">${ic(b.icon ?? 'circle', 26)}</span><div class="beat-body">${b.time ? `<div class="beat-time" data-t>${fmt(b.time)}</div>` : ''}<div class="beat-text" data-t>${fmt(b.text)}</div></div></div>`;
		}).join('');
		let outcome = '';
		if (s.outcome) {
			const o = s.outcome;
			outcome = `<div class="story-outcome t-${tone}" data-fit><div class="lbl" data-t>${fmt(o.label ?? 'Outcome')}</div>${o.value ? `<div class="story-value" data-t data-autofit="470">${fmt(o.value)}</div>` : ''}${o.text ? `<div class="story-text" data-t>${fmt(o.text)}</div>` : ''}${o.pill ? `<div class="story-pill">${pill({ text: o.pill, tone: o.pillTone ?? 'neutral', icon: o.pillIcon, size: 'm', white: true })}</div>` : ''}</div>`;
		}
		return heading(s) + body(`<div class="story"><div class="story-left">${who}<div class="story-beats">${beats}</div></div>${outcome}</div>`);
	},

	/** A row of 2-5 big icons with one to three words each. items: [{ icon, title, sub, tone }], arrows: true, note. */
	icons(s) {
		const n = s.items.length;
		const size = s.size ?? (n <= 3 ? 176 : n === 4 ? 156 : 136);
		const items = s.items.map((it, i) => {
			const tone = it.tone ?? stepTone(i);
			const el = `<div class="icons-item t-${tone}"><span class="icons-circle" style="width:${size}px;height:${size}px">${ic(it.icon, Math.round(size * 0.46))}</span><div class="icons-title" data-t>${fmt(it.title)}</div>${it.sub ? `<div class="icons-sub" data-t>${fmt(it.sub)}</div>` : ''}</div>`;
			return i < n - 1 && s.arrows ? `${el}<div class="icons-arrow" style="margin-top:${size / 2 - 12}px">${arrowSvg(64)}</div>` : el;
		}).join('');
		return heading(s) + body(`<div class="icons${s.arrows ? ' arrows' : ''}">${items}</div>${s.note ? `<div class="counters-note icons-note" data-t>${fmt(s.note)}</div>` : ''}`);
	},

	/** Who does what: steps left to right in 2-3 lanes (e.g. People and AI), so you see which steps a person does.
	 * lanes: [{ id, title, icon, tone }], steps: [{ lane (a lane id; null = across all lanes, e.g. the release), icon, title,
	 * sub }], hops: ['', 'label on the line from step 1 to step 2', ...]. */
	lanes(s) {
		const H = bodyHeight(s);
		const L = s.lanes.length;
		const labelW = 230;
		const laneGap = 18;
		const laneH = (H - laneGap * (L - 1)) / L;
		const n = s.steps.length;
		const slot = (W - labelW) / n;
		const dot = 96;
		const laneTop = j => j * (laneH + laneGap);
		const pos = s.steps.map((st, i) => {
			const j = st.lane == null ? -1 : s.lanes.findIndex(l => l.id === st.lane);
			if (st.lane != null && j < 0) {
				throw new Error(`lanes: step "${st.title}" names an unknown lane "${st.lane}" on ${s.id}`);
			}
			const cy = j < 0 ? H / 2 - 24 : laneTop(j) + laneH * 0.42;
			return { x: labelW + slot * i + slot / 2, y: cy, j };
		});
		const bands = s.lanes.map((l, j) => `<div class="ln-band t-${l.tone ?? stepTone(j)}" style="top:${r1(laneTop(j))}px;height:${r1(laneH)}px"><div class="ln-label" style="width:${labelW - 30}px">${ic(l.icon ?? 'person', 40)}<span data-t>${fmt(l.title)}</span></div></div>`).join('');
		let svg = '';
		pos.forEach((p, i) => {
			if (i === 0) {
				return;
			}
			const a = pos[i - 1];
			const x1 = a.x + dot / 2 + 10, x2 = p.x - dot / 2 - 14;
			let d;
			if (Math.abs(a.y - p.y) < 1) {
				d = `M ${r1(x1)} ${r1(a.y)} L ${r1(x2)} ${r1(p.y)}`;
			} else {
				// Change lanes between the two columns, where there is no text: right, down (or up), right.
				const xm = (a.x + p.x) / 2;
				const r = 26 * Math.sign(p.y - a.y);
				d = `M ${r1(x1)} ${r1(a.y)} H ${r1(xm - 26)} Q ${r1(xm)} ${r1(a.y)} ${r1(xm)} ${r1(a.y + r)} V ${r1(p.y - r)} Q ${r1(xm)} ${r1(p.y)} ${r1(xm + 26)} ${r1(p.y)} H ${r1(x2)}`;
			}
			svg += `<path d="${d}" fill="none" stroke="var(--connector)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${arrowHead(x2, p.y, x2 - 30, p.y, 'var(--connector)', 4)}`;
		});
		const hops = (s.hops ?? []).map((h, i) => {
			if (!h || !pos[i + 1]) {
				return '';
			}
			const a = pos[i], b = pos[i + 1];
			return `<div class="ln-hop" style="left:${r1((a.x + b.x) / 2)}px;top:${r1((a.y + b.y) / 2 - 46)}px" data-t>${fmt(h)}</div>`;
		}).join('');
		const steps = s.steps.map((st, i) => {
			const p = pos[i];
			const tone = p.j < 0 ? (st.tone ?? 'blue') : (st.tone ?? s.lanes[p.j].tone ?? stepTone(p.j));
			return `<div class="ln-step t-${tone}${p.j < 0 ? ' across' : ''}" style="left:${r1(p.x - slot / 2 + 8)}px;top:${r1(p.y - dot / 2)}px;width:${r1(slot - 16)}px"><span class="ln-dot" style="width:${dot}px;height:${dot}px">${ic(st.icon ?? 'circle', 44)}</span><div class="ln-title" data-t>${fmt(st.title)}</div>${st.sub ? `<div class="ln-sub" data-t>${fmt(st.sub)}</div>` : ''}</div>`;
		}).join('');
		return heading(s) + body(`<div class="lanes" style="height:${H}px">${bands}<svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${hops}${steps}</div>`, { vcenter: false });
	},

	/** Steps in a row with loops back drawn below them: a review that repeats until it's clean, then a person decides.
	 * steps (3-5): [{ icon | logo, title (<= 20), sub (<= 26), tone, solid }], hops: ['label on the arrow from step 1 to 2', ...],
	 * backs (1-2, inner first): [{ from, to, label, chips: [{ text, tone }], tone, dashed }],
	 * zone: { from, to, label, tone } (a tinted band behind steps from..to; its discs turn white, like the lanes). */
	loop(s) {
		const H = bodyHeight(s);
		const n = s.steps.length;
		const slot = W / n;
		const cx = i => slot * i + slot / 2;
		const R = 58;
		const backs = s.backs ?? [];
		const titleTop = s.zone ? 62 : 18;
		const cy = titleTop + 168;
		const apex = k => cy + R + 124 + k * 104;
		const contentH = apex(Math.max(0, backs.length - 1)) + 62;
		const dy = Math.max(0, (H - contentH) / 2);
		const inZone = i => s.zone && i >= s.zone.from && i <= s.zone.to;
		let svg = '';
		let labels = '';
		// The zone: a tinted band behind the steps that loop.
		let zone = '';
		if (s.zone) {
			const zx = slot * s.zone.from + 8, zw = slot * (s.zone.to - s.zone.from + 1) - 16;
			const zh = (backs.length ? apex(0) + 84 : cy + R + 48);
			zone = `<div class="lp-zone t-${s.zone.tone ?? 'purple'}" style="left:${r1(zx)}px;top:0;width:${r1(zw)}px;height:${r1(zh)}px">${s.zone.label ? `<div class="lbl" data-t>${fmt(s.zone.label)}</div>` : ''}</div>`;
		}
		// Arrows forward, with their labels above the line.
		for (let i = 0; i < n - 1; i++) {
			const x1 = cx(i) + R + 12, x2 = cx(i + 1) - R - 16;
			svg += `<path d="M ${r1(x1)} ${cy} H ${r1(x2)}" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/>${arrowHead(x2, cy, x2 - 30, cy, 'var(--connector)', 4)}`;
			if (s.hops?.[i]) {
				labels += `<div class="lp-hop" style="left:${r1((x1 + x2) / 2)}px;top:${cy - 44}px" data-t>${fmt(s.hops[i])}</div>`;
			}
		}
		// Loops back, drawn below the row: down from one step, along, and up into an earlier one.
		backs.forEach((b, k) => {
			const tone = b.tone ?? 'neutral';
			const color = tone === 'neutral' ? 'var(--connector)' : `var(--${tone})`;
			const off = k % 2 === 0 ? 26 : -26;
			const xs = cx(b.from), xe = cx(b.to) + off;
			const ys = cy + R + 10, ya = apex(k), ye = cy + Math.sqrt((R + 12) ** 2 - off ** 2);
			const rr = 36;
			const d = `M ${r1(xs)} ${r1(ys)} V ${r1(ya - rr)} Q ${r1(xs)} ${r1(ya)} ${r1(xs - rr)} ${r1(ya)} H ${r1(xe + rr)} Q ${r1(xe)} ${r1(ya)} ${r1(xe)} ${r1(ya - rr)} V ${r1(ye + 4)}`;
			svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"${b.dashed ? ' stroke-dasharray="3 12"' : ''}/>${arrowHead(xe, ye + 4, xe, ye + 34, color, 4)}`;
			const mx = (xs + xe) / 2;
			const chips = b.chips?.length ? `<div class="lp-chips">${b.chips.map(c => pill({ text: c.text, tone: c.tone ?? 'red', icon: c.icon, solid: true, size: 'm' })).join('')}</div>` : '';
			labels += `<div class="lp-back${chips ? ' has-chips' : ''} t-${tone}" style="left:${r1(mx)}px;top:${r1(ya - (chips ? 24 : -8))}px">${chips}${b.label ? `<div class="lp-back-label" data-t>${fmt(b.label)}</div>` : ''}</div>`;
		});
		const steps = s.steps.map((st, i) => {
			const tone = st.tone ?? stepTone(i);
			const mark = st.logo ? logo(st.logo, 52, st.solid ? '#fff' : null) : ic(st.icon ?? 'circle', 50);
			return `<div class="lp-step t-${tone}${inZone(i) ? ' in-zone' : ''}${st.solid ? ' solid' : ''}" style="left:${r1(cx(i) - slot / 2 + 10)}px;top:${titleTop}px;width:${r1(slot - 20)}px"><div class="lp-title" data-t>${fmt(st.title)}</div>${st.sub ? `<div class="lp-sub" data-t>${fmt(st.sub)}</div>` : ''}<span class="lp-dot" style="top:${cy - titleTop - R}px;width:${R * 2}px;height:${R * 2}px;margin-left:${-R}px">${mark}</span></div>`;
		}).join('');
		return heading(s) + body(`<div class="lp" style="height:${H}px"><div class="lp-in" style="top:${r1(dy)}px;height:${r1(contentH)}px">${zone}<svg class="rd-svg" width="${W}" height="${r1(contentH)}" viewBox="0 0 ${W} ${r1(contentH)}">${svg}</svg>${steps}${labels}</div></div>`, { vcenter: false });
	},

	/** Written once, read by everyone: 1-3 inputs stacked on the left, a hub, and curves fanning out to 3-7 readers.
	 * inputs: [{ icon, title (<= 18; `code` for file names), sub (<= 30), tone }], hub: { logo | icon, title, tone },
	 * readers: [{ logo | icon, title (<= 26), sub (<= 30), tone }]. (Not `sources`: every slide's sources are its citations.) */
	fan(s) {
		const H = bodyHeight(s);
		const k = s.inputs.length;
		const srcW = s.sourceWidth ?? 500;
		const gap = 26;
		const srcH = Math.min(150, (H - gap * (k - 1)) / k);
		const srcTop = (H - (k * srcH + gap * (k - 1))) / 2;
		const hubD = 150;
		const hx = srcW + 210, hy = H / 2;
		const m = s.readers.length;
		const tx = hx + hubD / 2 + 300;
		const rowH = Math.min(118, (H - 20) / m);
		const tTop = (H - rowH * m) / 2;
		const tD = 66;
		let svg = '';
		const inputs = s.inputs.map((src, i) => {
			const tone = src.tone ?? stepTone(i);
			const y = srcTop + i * (srcH + gap);
			const sy = y + srcH / 2;
			svg += `<path d="M ${srcW + 4} ${r1(sy)} C ${srcW + 90} ${r1(sy)}, ${hx - hubD / 2 - 90} ${r1(hy)}, ${hx - hubD / 2 - 8} ${r1(hy)}" fill="none" stroke="var(--${tone})" stroke-width="4" stroke-linecap="round"/><circle cx="${srcW + 4}" cy="${r1(sy)}" r="6" fill="var(--${tone})"/>`;
			return `<div class="fn-src t-${tone}" data-fit style="left:0;top:${r1(y)}px;width:${srcW}px;height:${r1(srcH)}px">${iconTile(src.icon ?? 'document', { tone, size: 64 })}<div><div class="t" data-t>${fmt(src.title)}</div>${src.sub ? `<div class="s" data-t>${fmt(src.sub)}</div>` : ''}</div></div>`;
		}).join('');
		const hubTone = s.hub?.tone ?? 'blue';
		const hub = `<div class="fn-hub t-${hubTone}" style="left:${hx - hubD / 2}px;top:${r1(hy - hubD / 2)}px;width:${hubD}px;height:${hubD}px">${s.hub?.logo ? logo(s.hub.logo, 70) : ic(s.hub?.icon ?? 'folder', 64)}</div>${s.hub?.title ? `<div class="fn-hub-title" style="left:${hx}px;top:${r1(hy + hubD / 2 + 14)}px" data-t>${fmt(s.hub.title)}</div>` : ''}`;
		const readers = s.readers.map((t, j) => {
			const tone = t.tone ?? 'blue';
			const y = tTop + j * rowH + rowH / 2;
			const ex = tx - tD / 2 - 12;
			svg += `<path d="M ${hx + hubD / 2 + 8} ${r1(hy)} C ${hx + hubD / 2 + 130} ${r1(hy)}, ${ex - 140} ${r1(y)}, ${r1(ex)} ${r1(y)}" fill="none" stroke="var(--connector)" stroke-width="3.5" stroke-linecap="round"/>${arrowHead(ex, y, ex - 30, y, 'var(--connector)', 3.5)}`;
			const mark = t.logo ? logo(t.logo, 34) : ic(t.icon ?? 'person', 32);
			return `<div class="fn-target t-${tone}" style="left:${tx - tD / 2}px;top:${r1(y - tD / 2)}px;height:${tD}px"><span class="fn-dot" style="width:${tD}px;height:${tD}px">${mark}</span><div><div class="t" data-t>${fmt(t.title)}</div>${t.sub ? `<div class="s" data-t>${fmt(t.sub)}</div>` : ''}</div></div>`;
		}).join('');
		// Centre the drawing: from the inputs' left edge to the end of the longest reader label (about 0.47 em a character).
		const labelW = Math.max(...s.readers.map(t => Math.max(String(t.title ?? '').length * 26, String(t.sub ?? '').length * 20) * 0.47));
		const shift = Math.max(0, (W - (tx + tD / 2 + 20 + labelW)) / 2);
		return heading(s) + body(`<div class="fn" style="height:${H}px"><div class="fn-in" style="left:${r1(shift)}px;height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${inputs}${hub}${readers}</div></div>`, { vcenter: false });
	},

	/** How to do it in an app, step by step, with the real keys and screens drawn small (for people new to the app).
	 * steps (2-5): [{ title (<= 24), sub (<= 28), ui }], where ui is one of:
	 *   { keys: ['F1'], alts: [{ label: 'Mac', keys: ['⇧', '⌘', 'P'] }] }   keycaps
	 *   { palette: 'typed text', items: ['Command title'], pick: 0 }         the command list, one row picked
	 *   { prompt: 'text above the box', input: 'what you paste' }           an input box
	 *   { prompt: 'text above the list', list: ['name', ...], pick: 0 }   a list to pick from
	 * button: { url, label, caption, icon } (a real link in the PDF, e.g. vscode://... to install in one click), note. */
	howto(s) {
		const H = bodyHeight(s);
		const n = s.steps.length;
		const gap = 60;
		const colW = (W - gap * (n - 1)) / n;
		const footH = s.button || s.note ? 96 : 0;
		const uiTop = 104;
		const uiH = Math.min(330, H - footH - uiTop - 12);
		const key = (k, small) => `<span class="ht-key${small ? ' small' : ''}">${esc(k)}</span>`;
		const ui = u => {
			if (u.keys) {
				const alts = (u.alts ?? []).map(a => `<div class="ht-alt"><span class="ht-alt-label">${esc(a.label)}</span>${a.keys.map(k => key(k, true)).join('')}</div>`).join('');
				return `<div class="ht-keys">${u.keys.map(k => key(k)).join('')}</div>${alts ? `<div class="ht-or">or</div>${alts}` : ''}`;
			}
			if (u.palette !== undefined) {
				const rows = (u.items ?? []).map((it, i) => `<div class="ht-row${i === (u.pick ?? 0) ? ' on' : ''}">${esc(it)}</div>`).join('');
				return `<div class="ht-field">&gt; ${esc(u.palette)}<i class="ht-caret"></i></div>${rows}`;
			}
			if (u.input !== undefined) {
				return `${u.prompt ? `<div class="ht-prompt">${esc(u.prompt)}</div>` : ''}<div class="ht-field focus">${esc(u.input)}<i class="ht-caret"></i></div>${u.hint ? `<div class="ht-hint">${esc(u.hint)}</div>` : ''}`;
			}
			if (u.list) {
				const rows = u.list.map((it, i) => `<div class="ht-row${i === (u.pick ?? 0) ? ' on' : ''}">${i === (u.pick ?? 0) ? '<span class="ht-check">\u2713</span>' : ''}${esc(it)}</div>`).join('');
				return `${u.prompt ? `<div class="ht-prompt">${esc(u.prompt)}</div>` : ''}${rows}`;
			}
			return '';
		};
		let arrows = '';
		const cols = s.steps.map((st, i) => {
			const x = i * (colW + gap);
			if (i < n - 1) {
				const ax = x + colW + gap / 2;
				arrows += `<span class="ht-arrow" style="left:${r1(ax - 18)}px;top:${r1(uiTop + uiH / 2 - 18)}px">${ic('arrowRight', 36)}</span>`;
			}
			return `<div class="ht-step t-${st.tone ?? 'blue'}" style="left:${r1(x)}px;width:${r1(colW)}px"><div class="ht-head"><span class="st-badge ht-n" data-t>${i + 1}</span><div><div class="ht-title" data-t>${fmt(st.title)}</div>${st.sub ? `<div class="ht-sub" data-t>${fmt(st.sub)}</div>` : ''}</div></div><div class="ht-ui" style="top:${uiTop}px;height:${r1(uiH)}px">${ui(st.ui ?? {})}</div></div>`;
		}).join('');
		let foot = '';
		if (footH) {
			const b = s.button;
			const button = b ? `<a class="ht-button" href="${esc(b.url)}">${ic(b.icon ?? 'download', 30)}<span data-t>${fmt(b.label)}</span></a>${b.caption ? `<span class="ht-button-cap" data-t>${fmt(b.caption)}</span>` : ''}` : '';
			foot = `<div class="ht-foot" style="top:${r1(H - footH + 22)}px">${button}${s.note ? `<span class="ht-note" data-t>${fmt(s.note)}</span>` : ''}</div>`;
		}
		return heading(s) + body(`<div class="ht" style="height:${H}px">${cols}${arrows}${foot}</div>`, { vcenter: false });
	},

	/** Settings drawn as sliders: where the knob sits, and which one is locked.
	 * rows (2-3): [{ label, left: { text (<= 22), icon }, right: { text, icon }, at (0-1), tone, icon (on the knob), lock: true,
	 *   mark (a pill under the knob, <= 22) }]. */
	sliders(s) {
		const H = bodyHeight(s);
		const n = s.rows.length;
		const rowH = 236;
		const gapY = n > 2 ? 24 : 70;
		const top = Math.max(0, (H - (n * rowH + (n - 1) * gapY)) / 2);
		const trackY = 150;
		const K = 84;
		const rows = s.rows.map((r, i) => {
			const tone = r.tone ?? stepTone(i);
			const y = top + i * (rowH + gapY);
			const kx = Math.max(K / 2, Math.min(W - K / 2, r.at * W));
			const end = (e, side) => e ? `<div class="sl-end ${side}" data-t>${e.icon ? ic(e.icon, 30) : ''}<span>${fmt(e.text)}</span></div>` : '';
			const fill = r.lock ? `<i class="sl-fill" style="left:0;width:${r1(kx)}px"></i><i class="sl-locked" style="left:${r1(kx)}px;width:${r1(W - kx)}px"></i>` : `<i class="sl-fill" style="left:0;width:${r1(kx)}px"></i>`;
			const knob = `<span class="sl-knob" style="left:${r1(kx - K / 2)}px;top:${trackY - K / 2}px;width:${K}px;height:${K}px">${ic(r.lock ? 'lockFilled' : (r.icon ?? 'checkmark'), 38)}</span>`;
			const markW = 300;
			const mx = Math.max(0, Math.min(W - markW, kx - markW / 2));
			const mark = r.mark ? `<div class="sl-mark" style="left:${r1(mx)}px;width:${markW}px;top:${trackY + K / 2 + 16}px">${pill({ text: r.mark, tone, icon: r.lock ? 'lock' : 'checkmark', solid: true })}</div>` : '';
			return `<div class="sl-row t-${tone}" style="top:${r1(y)}px;height:${rowH}px"><div class="lbl" data-t>${fmt(r.label)}</div>${end(r.left, 'left')}${end(r.right, 'right')}<div class="sl-track" style="top:${trackY - 8}px">${fill}</div>${knob}${mark}</div>`;
		}).join('');
		return heading(s) + body(`<div class="sl" style="height:${H}px">${rows}</div>`, { vcenter: false });
	},

	/** Many agents work on their own; every change passes one person before it ships, and nothing goes around.
	 * zone: { label, tone }, workers (2-4): [{ icon, title (<= 18) }], gate: { icon, title (<= 26), tone },
	 * exit: { icon, title (<= 12), tone }, bypass: { label (<= 20) } (a blocked path straight from the agents to the exit). */
	gate(s) {
		const H = bodyHeight(s);
		const k = s.workers.length;
		const zoneW = s.zoneWidth ?? 660;
		const zoneTop = 96, zoneBottom = H - 6;
		const cy = (zoneTop + zoneBottom) / 2;
		const D = 92;
		const rowH = Math.min(150, (zoneBottom - zoneTop - 70) / k);
		const firstY = cy - ((k - 1) * rowH) / 2 + 18;
		const wx = zoneW - 70;
		const G = 176, gx = zoneW + 360;
		const E = 132, ex = W - 120;
		const gateTone = s.gate.tone ?? 'green', exitTone = s.exit.tone ?? 'green';
		let svg = '';
		const workers = s.workers.map((w, i) => {
			const y = firstY + i * rowH;
			const x1 = wx + D / 2 + 10, x2 = gx - G / 2 - 16;
			svg += `<path d="M ${r1(x1)} ${r1(y)} C ${r1(x1 + 150)} ${r1(y)}, ${r1(x2 - 170)} ${r1(cy)}, ${r1(x2)} ${r1(cy)}" fill="none" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/>`;
			return `<div class="ga-worker" style="top:${r1(y - D / 2)}px;right:${r1(W - wx - D / 2)}px;height:${D}px"><span class="ga-wt" data-t>${fmt(w.title)}</span><span class="ga-wdot" style="width:${D}px;height:${D}px">${ic(w.icon ?? 'bot', 44)}</span></div>`;
		}).join('');
		svg += arrowHead(gx - G / 2 - 16, cy, gx - G / 2 - 46, cy, 'var(--connector)', 4);
		const a1 = gx + G / 2 + 14, a2 = ex - E / 2 - 16;
		svg += `<path d="M ${r1(a1)} ${r1(cy)} H ${r1(a2)}" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/>${arrowHead(a2, cy, a2 - 30, cy, 'var(--connector)', 4)}`;
		// The way around the person: from the agents, over the gate, to the exit, and blocked in the middle.
		let bypass = '';
		if (s.bypass) {
			const sx = zoneW - 24, sy = zoneTop + 20, top = 22, ey = cy - E / 2 - 14;
			svg += `<path d="M ${r1(sx)} ${r1(sy)} C ${r1(sx + 260)} ${top}, ${r1(ex - 260)} ${top}, ${r1(ex)} ${r1(ey)}" fill="none" stroke="var(--red)" stroke-width="4" stroke-linecap="round" stroke-dasharray="3 12"/>${arrowHead(ex, ey, ex - 260, top, 'var(--red)', 4)}`;
			const mx = (sx + ex) / 2, my = 0.125 * sy + 0.375 * top * 2 + 0.125 * ey;
			bypass = `<span class="ga-no" style="left:${r1(mx - 34)}px;top:${r1(my - 34)}px">${ic('prohibited', 44)}</span><div class="ga-no-label" style="left:${r1(mx - 200)}px;top:${r1(my + 46)}px;width:400px" data-t>${fmt(s.bypass.label)}</div>`;
		}
		const zone = `<div class="ga-zone t-${s.zone?.tone ?? 'purple'}" style="left:0;top:${zoneTop}px;width:${zoneW}px;height:${zoneBottom - zoneTop}px">${s.zone?.label ? `<div class="lbl" data-t>${fmt(s.zone.label)}</div>` : ''}</div>`;
		const gate = `<span class="ga-gate t-${gateTone}" style="left:${gx - G / 2}px;top:${r1(cy - G / 2)}px;width:${G}px;height:${G}px">${ic(s.gate.icon ?? 'eye', 76)}</span><div class="ga-title t-${gateTone}" style="left:${gx - 260}px;top:${r1(cy + G / 2 + 22)}px;width:520px" data-t>${fmt(s.gate.title)}</div>`;
		const exit = `<span class="ga-exit t-${exitTone}" style="left:${ex - E / 2}px;top:${r1(cy - E / 2)}px;width:${E}px;height:${E}px">${ic(s.exit.icon ?? 'rocket', 60)}</span><div class="ga-title small" style="left:${ex - 120}px;top:${r1(cy + E / 2 + 18)}px;width:240px" data-t>${fmt(s.exit.title)}</div>`;
		return heading(s) + body(`<div class="ga" style="height:${H}px">${zone}<svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${workers}${gate}${exit}${bypass}</div>`, { vcenter: false });
	},

	/** Two halves of one idea, side by side, joined by an arrow: a dark half and a light one (e.g. while you're away / when
	 * you're back). left/right: { label (small caps), icon, title (<= 30), hero: ['icon', ...] (1-4 big icons in the middle),
	 * card: { icon, text (<= 40) } (one message-like line in the middle, e.g. what the agent leaves for you),
	 * items: [{ icon, text (<= 26) }], dark: true, tone }. */
	halves(s) {
		const H = bodyHeight(s);
		const gap = 112;
		const pw = (W - gap) / 2;
		const half = (p, x) => {
			const tone = p.tone ?? (p.dark ? 'blue' : 'green');
			const items = (p.items ?? []).map(it => `<div class="hv-item">${ic(it.icon ?? 'checkmark', 34)}<span data-t>${fmt(it.text)}</span></div>`).join('');
			const hero = p.hero ? `<div class="hv-hero">${p.hero.map(h => `<span class="hv-hero-dot">${ic(h, 56)}</span>`).join('')}</div>` : '';
			const card = p.card ? `<div class="hv-card">${ic(p.card.icon ?? 'bot', 34)}<span data-t>${fmt(p.card.text)}</span></div>` : '';
			return `<div class="hv${p.dark ? ' dark' : ''} t-${tone}" data-fit style="left:${r1(x)}px;width:${r1(pw)}px;height:${H}px"><div class="hv-top">${ic(p.icon ?? 'circle', 40)}<span class="lbl" data-t>${fmt(p.label ?? '')}</span></div><div class="hv-title" data-t>${fmt(p.title)}</div>${hero}${card}<div class="hv-items">${items}</div></div>`;
		};
		const arrowTone = s.arrowTone ?? s.right?.tone ?? 'green';
		const arrow = `<span class="hv-arrow t-${arrowTone}" style="left:${r1(W / 2 - 50)}px;top:${r1(H / 2 - 50)}px">${ic('arrowRight', 48)}</span>`;
		return heading(s) + body(`<div class="hvs" style="height:${H}px">${half(s.left, 0)}${half(s.right, pw + gap)}${arrow}</div>`, { vcenter: false });
	},

	/** How an agent sees an app, side by side: as a screenshot, as the app's tree of named parts, or both.
	 * ways (2-3): [{ pic: 'screen' | 'tree' | 'both', title (<= 20), sub (<= 26), pros (<= 26), cons (<= 30), tone }]. */
	ways(s) {
		const H = bodyHeight(s);
		const n = s.ways.length;
		const gap = 36;
		const cw = (W - gap * (n - 1)) / n;
		const picH = Math.min(420, H - 274);
		const cols = s.ways.map((w, i) => {
			const tone = w.tone ?? stepTone(i);
			const pros = w.pros ? `<div class="wy-pc pro">${ic('checkmark', 26)}<span data-t>${fmt(w.pros)}</span></div>` : '';
			const cons = w.cons ? `<div class="wy-pc con">${ic('warning', 26)}<span data-t>${fmt(w.cons)}</span></div>` : '';
			return `<div class="wy t-${tone}" data-fit style="left:${r1(i * (cw + gap))}px;width:${r1(cw)}px;height:${H}px"><div class="wy-pic" style="height:${picH}px">${wayPic(w.pic, w.label)}</div><div class="wy-title" data-t>${fmt(w.title)}</div>${w.sub ? `<div class="wy-sub" data-t>${fmt(w.sub)}</div>` : ''}<div class="wy-pcs">${pros}${cons}</div></div>`;
		}).join('');
		return heading(s) + body(`<div class="wys" style="height:${H}px">${cols}</div>`, { vcenter: false });
	},

	/** A loop: the same job, started again and again on a timer. Each run starts fresh but reads and writes one shared file.
	 * task (<= 40), times (3-5): ['9:00', ...], run (label under each run, <= 14), memory: { file, text (<= 34) },
	 * sides (1-2): [{ icon, title (<= 10), sub (<= 30) }]. */
	runs(s) {
		const H = bodyHeight(s);
		const n = s.times.length;
		const moreW = 150;
		const slot = (W - moreW) / n;
		const cx = i => slot * i + slot / 2;
		const taskH = 60;
		const axisY = taskH + 60;
		const D = 104;
		const runY = axisY + 104;
		const memTop = runY + D / 2 + 112;
		const memH = 104;
		const sideTop = memTop + memH + 40;
		let svg = `<path d="M 0 ${axisY} H ${W - 40}" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/>${arrowHead(W - 40, axisY, W - 70, axisY, 'var(--connector)', 4)}`;
		let html = '';
		s.times.forEach((t, i) => {
			const x = cx(i);
			svg += `<path d="M ${r1(x)} ${axisY} V ${runY - D / 2 - 12}" stroke="var(--connector)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>`;
			const y1 = runY + D / 2 + 10, y2 = memTop - 10;
			svg += `<path d="M ${r1(x - 16)} ${y1} V ${y2}" stroke="var(--purple)" stroke-width="4" stroke-linecap="round"/>${arrowHead(x - 16, y2, x - 16, y2 - 30, 'var(--purple)', 4)}`;
			svg += `<path d="M ${r1(x + 16)} ${y2} V ${y1}" stroke="var(--purple)" stroke-width="4" stroke-linecap="round"/>${arrowHead(x + 16, y1, x + 16, y1 + 30, 'var(--purple)', 4)}`;
			html += `<div class="rn-time" style="left:${r1(x - 80)}px;top:${axisY - 22}px" data-t>${ic('clock', 24)}<span>${esc(t)}</span></div>`;
			html += `<span class="rn-run" style="left:${r1(x - D / 2)}px;top:${runY - D / 2}px;width:${D}px;height:${D}px">${ic('bot', 50)}</span>`;
			if (s.run) {
				html += `<div class="rn-label" style="left:${r1(x + D / 2 + 14)}px;top:${runY - 16}px" data-t>${fmt(s.run)}</div>`;
			}
		});
		if (s.rw) {
			const x = cx(0);
			html += `<div class="rn-rw" style="left:${r1(x + 32)}px;top:${r1((runY + D / 2 + memTop) / 2 - 14)}px" data-t>${fmt(s.rw)}</div>`;
		}
		html += `<div class="rn-more" style="left:${W - moreW + 20}px;top:${runY - 30}px" data-t>\u2026</div>`;
		const m = s.memory ?? {};
		html += `<div class="rn-mem" style="top:${memTop}px;height:${memH}px">${ic('documentText', 40)}<span class="rn-file" data-t>${esc(m.file ?? 'NOTES.md')}</span><span class="rn-memtext" data-t>${fmt(m.text ?? '')}</span></div>`;
		if (s.task) {
			html += `<div class="rn-task" data-t>${ic('repeat', 30)}<span>${fmt(s.task)}</span></div>`;
		}
		const sides = (s.sides ?? []).map(sd => `<div class="rn-side">${iconTile(sd.icon ?? 'laptop', { tone: sd.tone ?? 'blue', size: 64, round: true })}<div><div class="t" data-t>${fmt(sd.title)}</div>${sd.sub ? `<div class="s" data-t>${fmt(sd.sub)}</div>` : ''}</div></div>`).join('');
		return heading(s) + body(`<div class="rn" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${html}<div class="rn-sides" style="top:${sideTop}px">${sides}</div></div>`, { vcenter: false });
	},

	/** The model in the middle, its tools around it, grouped by kind; an optional numbered path shows one example.
	 * center: { icon | logo, title }, ask (the example question, <= 40), path: ['id', ...] (the order the model uses them),
	 * groups (1-4): [{ title, tone, items: [{ id, icon | logo, title (<= 20) }] }] (5-9 items in total). */
	hub(s) {
		const H = bodyHeight(s);
		const nodes = s.groups.flatMap((g, gi) => g.items.map(it => ({ ...it, tone: it.tone ?? g.tone ?? stepTone(gi) })));
		const n = nodes.length;
		const cx = W / 2 + (s.shift ?? 0), cy = H / 2 + 24;
		const rx = s.rx ?? 500, ry = s.ry ?? (H / 2 - 84);
		const C = 176, D = 78;
		const order = new Map((s.path ?? []).map((id, k) => [id, k + 1]));
		let svg = '';
		let html = '';
		nodes.forEach((nd, i) => {
			const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n;
			const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
			const k = order.get(nd.id);
			const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy);
			const sx = cx + (dx / len) * (C / 2 + 10), sy = cy + (dy / len) * (C / 2 + 10);
			const ex = x - (dx / len) * (D / 2 + 10), ey = y - (dy / len) * (D / 2 + 10);
			svg += k
				? `<path d="M ${r1(sx)} ${r1(sy)} L ${r1(ex)} ${r1(ey)}" stroke="var(--${nd.tone})" stroke-width="5" stroke-linecap="round"/>`
				: `<path d="M ${r1(sx)} ${r1(sy)} L ${r1(ex)} ${r1(ey)}" stroke="var(--connector)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>`;
			const right = dx >= 0;
			const mark = nd.logo ? logo(nd.logo, 38) : ic(nd.icon ?? 'wrench', 38);
			html += `<span class="hb-dot t-${nd.tone}${k ? ' on' : ''}" style="left:${r1(x - D / 2)}px;top:${r1(y - D / 2)}px;width:${D}px;height:${D}px">${mark}${k ? `<span class="st-badge hb-n" data-t>${k}</span>` : ''}</span>`;
			html += `<div class="hb-label${right ? '' : ' left'}" style="${right ? `left:${r1(x + D / 2 + 16)}px` : `right:${r1(W - (x - D / 2 - 16))}px`};top:${r1(y - 18)}px" data-t>${fmt(nd.title)}</div>`;
		});
		const c = s.center ?? {};
		html += `<span class="hb-center" style="left:${r1(cx - C / 2)}px;top:${r1(cy - C / 2)}px;width:${C}px;height:${C}px">${c.logo ? logo(c.logo, 64, '#fff') : ic(c.icon ?? 'brain', 64)}${c.title ? `<span class="hb-ctitle" data-t>${fmt(c.title)}</span>` : ''}</span>`;
		const ask = s.ask ? `<div class="hb-ask">${ic('chat', 30)}<span data-t>${fmt(s.ask)}</span></div>` : '';
		const legend = `<div class="hb-legend">${s.groups.map((g, gi) => `<span class="hb-leg t-${g.tone ?? stepTone(gi)}"><i></i><span data-t>${fmt(g.title)}</span></span>`).join('')}</div>`;
		return heading(s) + body(`<div class="hb" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${html}${ask}${legend}</div>`, { vcenter: false });
	},

	/** Three dartboards: what each kind of prompt gets you. items (3): [{ title, prompt (<= 44), hits: 'scatter' | 'center' |
	 * 'off', verdict (<= 26), tone }]. */
	targets(s) {
		const H = bodyHeight(s);
		const n = s.items.length;
		const gap = 44;
		const cw = (W - gap * (n - 1)) / n;
		const R = Math.min(140, (H - 290) / 2);
		const HITS = {
			scatter: [[-0.78, -0.52], [0.62, -0.86], [0.98, 0.34], [-0.3, 0.9], [-1.08, 0.5], [0.22, -0.14]],
			center: [[0.05, -0.07], [-0.08, 0.05], [0.07, 0.09], [-0.03, -0.11]],
			off: [[0.6, -0.52], [0.68, -0.6], [0.56, -0.62], [0.7, -0.47]],
		};
		const cols = s.items.map((it, i) => {
			const tone = it.tone ?? stepTone(i);
			const size = 2 * R + 40;
			const c = size / 2;
			let board = '';
			[1, 0.75, 0.5, 0.25].forEach((f, k) => {
				board += `<circle cx="${c}" cy="${c}" r="${r1(R * f)}" fill="${k % 2 ? '#fff' : `var(--${tone}-tint, var(--tint))`}"/>`;
			});
			board += `<circle cx="${c}" cy="${c}" r="${r1(R * 0.11)}" fill="var(--green)"/>`;
			const hits = (HITS[it.hits] ?? []).map(([hx, hy]) => `<circle cx="${r1(c + hx * R)}" cy="${r1(c + hy * R)}" r="11" fill="var(--ink)" stroke="#fff" stroke-width="4"/>`).join('');
			const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible">${board}${hits}</svg>`;
			return `<div class="tg t-${tone}" style="left:${r1(i * (cw + gap))}px;width:${r1(cw)}px"><div class="tg-board">${svg}</div><div class="tg-title" data-t>${fmt(it.title)}</div><div class="tg-prompt" data-t>${fmt(it.prompt)}</div><div class="tg-verdict" data-t>${ic(it.icon ?? (it.hits === 'center' ? 'checkmark' : 'warning'), 26)}<span>${fmt(it.verdict)}</span></div></div>`;
		}).join('');
		return heading(s) + body(`<div class="tgs" style="height:${H}px">${cols}</div>`, { vcenter: false });
	},

	/** Three paths from your idea to the goal: no walls (it wanders), walls with room (it gets there its own way), a narrow
	 * tunnel (it follows your steps into a dead end). items (3): [{ kind: 'open' | 'rails' | 'tunnel', title, prompt (<= 40),
	 * verdict (<= 22), tone }], start (label), goal (label). */
	corridors(s) {
		const H = bodyHeight(s);
		const n = s.items.length;
		const rowH = H / n;
		const textW = 470;
		const x0 = textW + 50, x1 = W - 330;
		let svg = '';
		let html = '';
		s.items.forEach((it, i) => {
			const tone = it.tone ?? stepTone(i);
			const color = `var(--${tone})`;
			const my = i * rowH + rowH / 2;
			const flag = `<span class="cr-goal" style="left:${x1 + 10}px;top:${r1(my - 30)}px">${ic('flag', 36)}</span>`;
			svg += `<circle cx="${x0}" cy="${r1(my)}" r="12" fill="var(--ink)"/>`;
			if (it.kind === 'open') {
				const pts = [[x0, my], [x0 + 140, my - 64], [x0 + 300, my + 58], [x0 + 470, my - 70], [x0 + 640, my + 40], [x1 - 120, my - 74]];
				let d = `M ${pts[0][0]} ${r1(pts[0][1])}`;
				for (let k = 1; k < pts.length; k++) {
					const [px, py] = pts[k - 1], [qx, qy] = pts[k];
					d += ` C ${r1(px + (qx - px) / 2)} ${r1(py)}, ${r1(px + (qx - px) / 2)} ${r1(qy)}, ${r1(qx)} ${r1(qy)}`;
				}
				svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 12"/>`;
				html += `<span class="cr-lost" style="left:${x1 - 150}px;top:${r1(my - 104)}px">?</span>`;
			} else if (it.kind === 'rails') {
				const w = 58;
				svg += `<rect x="${x0 + 40}" y="${r1(my - w)}" width="${x1 - x0 - 40}" height="${2 * w}" rx="${w}" fill="var(--${tone}-tint, var(--tint))"/>`;
				svg += `<path d="M ${x0 + 40} ${r1(my - w)} H ${x1}" stroke="${color}" stroke-width="6" stroke-linecap="round"/><path d="M ${x0 + 40} ${r1(my + w)} H ${x1}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
				svg += `<path d="M ${x0} ${r1(my)} C ${x0 + 180} ${r1(my - 34)}, ${x0 + 320} ${r1(my + 34)}, ${x0 + 480} ${r1(my)} S ${x1 - 160} ${r1(my - 30)}, ${x1 - 6} ${r1(my)}" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>${arrowHead(x1 - 6, my, x1 - 36, my, 'var(--ink)', 5)}`;
			} else {
				const w = 13, end = x0 + (x1 - x0) * 0.62;
				svg += `<path d="M ${x0 + 40} ${r1(my - w - 4)} H ${end}" stroke="${color}" stroke-width="6" stroke-linecap="round"/><path d="M ${x0 + 40} ${r1(my + w + 4)} H ${end}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
				svg += `<path d="M ${end + 8} ${r1(my - 52)} V ${r1(my + 52)}" stroke="var(--red)" stroke-width="10" stroke-linecap="round"/>`;
				svg += `<path d="M ${x0} ${r1(my)} H ${end - 18}" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>${arrowHead(end - 18, my, end - 48, my, 'var(--ink)', 5)}`;
			}
			html += flag;
			html += `<div class="cr-text t-${tone}" style="top:${r1(i * rowH)}px;height:${r1(rowH)}px;width:${textW}px"><div class="cr-title" data-t>${fmt(it.title)}</div><div class="cr-prompt" data-t>${fmt(it.prompt)}</div></div>`;
			html += `<div class="cr-verdict t-${tone}" style="left:${x1 + 70}px;top:${r1(my - 20)}px;width:${W - x1 - 70}px" data-t>${fmt(it.verdict)}</div>`;
		});
		return heading(s) + body(`<div class="crs" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** Raw input becomes clean output: what you said (fillers in ~~double tildes~~ are struck out), what cleans it, what comes
	 * out. from: { icon, label, text }, via: { icon, label, sub }, to: { icon, label, text }, note. */
	transform(s) {
		const H = bodyHeight(s);
		const viaW = 230, gap = 74;
		const sideW = (W - viaW - 2 * gap) / 2;
		const boxH = Math.min(420, H - (s.note ? 120 : 30));
		const top = (H - boxH - (s.note ? 90 : 0)) / 2;
		const raw = t => esc(t).split(/~~(.+?)~~/).map((part, k) => (k % 2 ? `<s class="tf-filler">${part}</s>` : part)).join('');
		const panel = (p, x, tone, filler) => `<div class="tf-panel t-${tone}" data-fit style="left:${r1(x)}px;top:${r1(top)}px;width:${r1(sideW)}px;height:${r1(boxH)}px"><div class="tf-head">${ic(p.icon ?? 'chat', 34)}<span class="lbl" data-t>${fmt(p.label ?? '')}</span></div><div class="tf-text${filler ? ' raw' : ''}" data-t>${filler ? raw(p.text) : fmt(p.text)}</div></div>`;
		const vx = sideW + gap;
		const D = 170;
		const vy = top + boxH / 2;
		const via = s.via ?? {};
		const viaHtml = `<span class="tf-via t-${via.tone ?? 'purple'}" style="left:${r1(vx + viaW / 2 - D / 2)}px;top:${r1(vy - D / 2 - 30)}px;width:${D}px;height:${D}px">${ic(via.icon ?? 'sparkle', 72)}</span><div class="tf-via-label" style="left:${r1(vx - 20)}px;width:${viaW + 40}px;top:${r1(vy + D / 2 - 14)}px"><div class="t" data-t>${fmt(via.label ?? '')}</div>${via.sub ? `<div class="s" data-t>${fmt(via.sub)}</div>` : ''}</div>`;
		const a1 = sideW + 14, a2 = vx + viaW / 2 - D / 2 - 14, b1 = vx + viaW / 2 + D / 2 + 14, b2 = vx + viaW + gap - 14;
		const ay = vy - 30;
		const svg = `<path d="M ${r1(a1)} ${r1(ay)} H ${r1(a2)}" stroke="var(--connector)" stroke-width="5" stroke-linecap="round"/>${arrowHead(a2, ay, a2 - 30, ay, 'var(--connector)', 5)}<path d="M ${r1(b1)} ${r1(ay)} H ${r1(b2)}" stroke="var(--connector)" stroke-width="5" stroke-linecap="round"/>${arrowHead(b2, ay, b2 - 30, ay, 'var(--connector)', 5)}`;
		const note = s.note ? `<div class="tf-note" style="top:${r1(top + boxH + 40)}px" data-t>${fmt(s.note)}</div>` : '';
		return heading(s) + body(`<div class="tf" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${panel(s.from, 0, s.from.tone ?? 'orange', true)}${viaHtml}${panel(s.to, W - sideW, s.to.tone ?? 'green', false)}${note}</div>`, { vcenter: false });
	},

	/** The agent interviews you, one question at a time; each answer adds a line to the spec on the right.
	 * ask (your first message), qa (2-4): [{ q (<= 44), rec (its recommended answer, <= 20), a (your answer, <= 16),
	 * spec (the line it writes, <= 30) }], spec: { file, title }. */
	interview(s) {
		const H = bodyHeight(s);
		const leftW = 1010;
		const specX = leftW + 120;
		const askH = s.ask ? 84 : 0;
		const n = s.qa.length;
		const rowH = (H - askH) / n;
		let html = '';
		let svg = '';
		if (s.ask) {
			html += `<div class="iv-ask" data-t>${ic('person', 28)}<span>${fmt(s.ask)}</span></div>`;
		}
		const specTop = askH + 10;
		const lines = [];
		s.qa.forEach((r, i) => {
			const y = askH + i * rowH;
			const qy = y + 6, ay = qy + 104;
			html += `<div class="iv-q" style="top:${r1(qy)}px">${iconTile('bot', { tone: 'purple', size: 52, round: true })}<div class="iv-qb"><div class="iv-qt" data-t>${fmt(r.q)}</div>${r.rec ? `<div class="iv-rec" data-t>I recommend: ${fmt(r.rec)}</div>` : ''}</div></div>`;
			html += `<div class="iv-a" style="top:${r1(ay)}px;right:${W - leftW}px" data-t>${fmt(r.a)}</div>`;
			lines.push({ y: ay + 26, text: r.spec });
		});
		const specH = H - specTop;
		html += `<div class="iv-spec" style="left:${specX}px;top:${specTop}px;width:${W - specX}px;height:${r1(specH)}px"><div class="iv-file">${ic('documentText', 30)}<span data-t>${esc(s.spec?.file ?? 'SPEC.md')}</span></div>${s.spec?.title ? `<div class="iv-stitle" data-t>${fmt(s.spec.title)}</div>` : ''}</div>`;
		lines.forEach(l => {
			html += `<div class="iv-line" style="left:${specX + 30}px;top:${r1(l.y - 22)}px;width:${W - specX - 60}px" data-t>${ic('checkmark', 26)}<span>${fmt(l.text)}</span></div>`;
			svg += `<path d="M ${leftW + 14} ${r1(l.y)} H ${specX + 18}" stroke="var(--green)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>`;
		});
		return heading(s) + body(`<div class="iv" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${html}</div>`, { vcenter: false });
	},

	/** You act as the product manager: a brainstorm with the agent becomes a written plan, you approve it, then it builds.
	 * steps (3): ['Brainstorm', 'It writes the plan', 'You approve'], chat: [{ from: 'you' | 'agent', text (<= 40) }],
	 * doc: { file, sections: [{ label, text } | { label, items: [...] }] }, approve: { label, sub }, roles: { you, agent }. */
	brief(s) {
		const H = bodyHeight(s);
		const gap = 70;
		const chatW = 470, docW = 640;
		const actW = W - chatW - docW - 2 * gap;
		const headH = 64;
		const top = headH + 18;
		const bh = H - top;
		const xs = [0, chatW + gap, chatW + docW + 2 * gap];
		const ws = [chatW, docW, actW];
		const heads = (s.steps ?? []).map((t, i) => `<div class="bf-step" style="left:${r1(xs[i])}px;width:${r1(ws[i])}px"><span class="st-badge bf-n" data-t>${i + 1}</span><span data-t>${fmt(t)}</span></div>`).join('');
		const chat = (s.chat ?? []).map(m => `<div class="bf-msg ${m.from === 'agent' ? 'agent' : 'you'}" data-t>${fmt(m.text)}</div>`).join('');
		const sections = (s.doc?.sections ?? []).map(sec => `<div class="bf-sec"><div class="lbl" data-t>${fmt(sec.label)}</div>${sec.text ? `<div class="bf-txt" data-t>${fmt(sec.text)}</div>` : ''}${sec.items ? `<div class="bf-items">${sec.items.map(x => `<div class="bf-item" data-t>${ic('checkmark', 22)}<span>${fmt(x)}</span></div>`).join('')}</div>` : ''}</div>`).join('');
		const ap = s.approve ?? {};
		let svg = '';
		[0, 1].forEach(i => {
			const xa = xs[i] + ws[i] + 12, xb = xs[i + 1] - 14, y = top + 130;
			svg += `<path d="M ${r1(xa)} ${r1(y)} H ${r1(xb)}" stroke="var(--connector)" stroke-width="5" stroke-linecap="round"/>${arrowHead(xb, y, xb - 30, y, 'var(--connector)', 5)}`;
		});
		const roles = s.roles ? `<div class="bf-roles" style="left:${r1(xs[2])}px;width:${r1(actW)}px;top:${r1(top + 290)}px"><div class="bf-role">${iconTile('person', { tone: 'blue', size: 48, round: true })}<span data-t>${fmt(s.roles.you)}</span></div><div class="bf-role">${iconTile('bot', { tone: 'purple', size: 48, round: true })}<span data-t>${fmt(s.roles.agent)}</span></div></div>` : '';
		return heading(s) + body(`<div class="bf" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${heads}<div class="bf-chat" style="left:0;top:${top}px;width:${chatW}px">${chat}</div><div class="bf-doc" data-fit style="left:${r1(xs[1])}px;top:${top}px;width:${docW}px;max-height:${r1(bh)}px"><div class="bf-file">${ic('documentText', 28)}<span data-t>${esc(s.doc?.file ?? 'PLAN.md')}</span></div>${sections}</div><div class="bf-act" style="left:${r1(xs[2])}px;top:${top}px;width:${r1(actW)}px"><div class="bf-btn" data-t>${ic('checkmark', 30)}<span>${fmt(ap.label ?? 'Approve')}</span></div>${ap.sub ? `<div class="bf-btn-sub" data-t>${fmt(ap.sub)}</div>` : ''}</div>${roles}</div>`, { vcenter: false });
	},

	/** The original and the copy side by side, compared picture by picture, again and again until they match.
	 * left/right: { title (<= 18), sub (<= 24), tone }, compare (label, <= 24), loop (label, <= 30),
	 * counter: { value (<= 8), label (<= 16) }, prompt (one line above, <= 50). */
	mirror(s) {
		const H = bodyHeight(s);
		const winH = Math.min(330, H - (s.prompt ? 70 : 10) - 250), winW = Math.round(winH * 520 / 330);
		const gapMid = 250;
		const total = winW * 2 + gapMid;
		const counterW = 260;
		const x0 = Math.max(0, (W - counterW - 40 - total) / 2);
		const top = s.prompt ? 70 : 10;
		const win = (x, p, diff) => `<div class="mr-win t-${p.tone ?? 'blue'}" style="left:${r1(x)}px;top:${top}px;width:${winW}px;height:${winH}px">${mirrorApp(diff)}</div><div class="mr-label" style="left:${r1(x)}px;top:${top + winH + 16}px;width:${winW}px"><div class="t" data-t>${fmt(p.title)}</div>${p.sub ? `<div class="s" data-t>${fmt(p.sub)}</div>` : ''}</div>`;
		const mx = x0 + winW + gapMid / 2;
		const D = 132, my = top + winH / 2;
		const cmp = `<span class="mr-cmp" style="left:${r1(mx - D / 2)}px;top:${r1(my - D / 2)}px;width:${D}px;height:${D}px">${ic('search', 58)}</span><div class="mr-cmp-label" style="left:${r1(mx - 125)}px;width:250px;top:${r1(my + D / 2 + 12)}px" data-t>${fmt(s.compare ?? '')}</div>`;
		const ly = top + winH + 132;
		const lx1 = x0 + winW / 2, lx2 = x0 + winW + gapMid + winW / 2;
		const svg = `<path d="M ${r1(lx2)} ${top + winH + 98} V ${r1(ly + 20)} Q ${r1(lx2)} ${r1(ly + 50)} ${r1(lx2 - 30)} ${r1(ly + 50)} H ${r1(lx1 + 30)} Q ${r1(lx1)} ${r1(ly + 50)} ${r1(lx1)} ${r1(ly + 20)} V ${top + winH + 98}" fill="none" stroke="var(--purple)" stroke-width="5" stroke-linecap="round"/>${arrowHead(lx1, top + winH + 98, lx1, top + winH + 128, 'var(--purple)', 5)}<path d="M ${r1(x0 + winW + 14)} ${r1(my)} H ${r1(mx - D / 2 - 10)}" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/><path d="M ${r1(mx + D / 2 + 10)} ${r1(my)} H ${r1(x0 + winW + gapMid - 14)}" stroke="var(--connector)" stroke-width="4" stroke-linecap="round"/>`;
		const loop = s.loop ? `<div class="mr-loop" style="left:${r1(lx1)}px;width:${r1(lx2 - lx1)}px;top:${r1(ly + 62)}px" data-t>${ic('repeat', 28)}<span>${fmt(s.loop)}</span></div>` : '';
		const counter = s.counter ? `<div class="mr-counter" style="left:${W - counterW}px;top:${top + 40}px;width:${counterW}px"><div class="v" data-t>${fmt(s.counter.value)}</div><div class="l" data-t>${fmt(s.counter.label ?? '')}</div></div>` : '';
		const prompt = s.prompt ? `<div class="mr-prompt" data-t>${ic('chat', 30)}<span>${fmt(s.prompt)}</span></div>` : '';
		return heading(s) + body(`<div class="mr" style="height:${H}px"><svg class="rd-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${prompt}${win(x0, s.left, false)}${win(x0 + winW + gapMid, s.right, true)}${cmp}${loop}${counter}</div>`, { vcenter: false });
	},
};

/** A small picture of one app window, seen three ways (for `ways`): screen = pixels and a click at x,y; tree = the named
 * parts a screen reader gets; both = the picture with each part named. */
function wayPic(kind, label = 'Budget.xlsx') {
	const win = `<rect x="10" y="10" width="460" height="290" rx="18" fill="#fff"/><path d="M 28 10 H 452 Q 470 10 470 28 V 52 H 10 V 28 Q 10 10 28 10 Z" fill="var(--fg)" fill-opacity=".16"/><circle cx="36" cy="31" r="6" fill="var(--fg)" fill-opacity=".5"/><circle cx="56" cy="31" r="6" fill="var(--fg)" fill-opacity=".5"/><circle cx="76" cy="31" r="6" fill="var(--fg)" fill-opacity=".5"/><text x="250" y="38" text-anchor="middle" font-size="17" font-weight="600" fill="var(--body)">${esc(label)}</text>`;
	const buttons = ['Save', 'Print', 'Share'].map((b, i) => `<rect x="${30 + i * 112}" y="70" width="100" height="40" rx="10" fill="var(--tint)"/><text x="${80 + i * 112}" y="96" text-anchor="middle" font-size="18" font-weight="600" fill="var(--ink)">${b}</text>`).join('');
	const rows = [0, 1, 2, 3].map(i => `<rect x="30" y="${136 + i * 38}" width="${[400, 330, 380, 260][i]}" height="16" rx="8" fill="var(--tint)"/>`).join('');
	let extra = '';
	if (kind === 'screen') {
		extra = `<circle cx="118" cy="104" r="16" fill="var(--fg)" fill-opacity=".18" stroke="var(--fg)" stroke-width="4"/><circle cx="118" cy="104" r="4" fill="var(--fg)"/><rect x="150" y="124" width="212" height="40" rx="20" fill="var(--fg)"/><text x="256" y="150" text-anchor="middle" font-size="19" font-weight="700" fill="#fff">click at x 118, y 104</text>`;
		return `<svg viewBox="0 0 480 310" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${win}${buttons}${rows}${extra}</svg>`;
	}
	if (kind === 'tree') {
		const L = [[24, 46, `Window \u201c${label}\u201d`], [64, 96, 'Toolbar'], [104, 146, 'Button \u201cSave\u201d'], [104, 196, 'Button \u201cPrint\u201d'], [64, 246, 'Table'], [104, 292, 'Cell B2 \u201c1,240\u201d']];
		let t = `<rect x="10" y="10" width="460" height="290" rx="18" fill="#fff"/>`;
		t += `<path d="M 40 58 V 246 M 40 96 H 58 M 40 246 H 58 M 80 108 V 196 M 80 146 H 98 M 80 196 H 98 M 80 258 V 292 M 80 292 H 98" fill="none" stroke="var(--fg)" stroke-opacity=".55" stroke-width="2.5"/>`;
		L.forEach(([x, y, text], i) => {
			if (i === 2) {
				t += `<rect x="${x - 8}" y="${y - 25}" width="190" height="36" rx="10" fill="var(--fg)"/><text x="${x}" y="${y}" font-size="19" font-weight="700" fill="#fff" font-family="var(--mono)">${esc(text)}</text><text x="${x + 196}" y="${y}" font-size="19" font-weight="700" fill="var(--fg)">\u2190 click</text>`;
			} else {
				t += `<text x="${x}" y="${y}" font-size="19" fill="var(--ink)" font-family="var(--mono)">${esc(text)}</text>`;
			}
		});
		return `<svg viewBox="0 0 480 310" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${t}</svg>`;
	}
	extra = ['Save', 'Print', 'Share'].map((b, i) => `<rect x="${26 + i * 112}" y="66" width="108" height="48" rx="12" fill="none" stroke="var(--fg)" stroke-width="3" stroke-dasharray="6 5"/><circle cx="${30 + i * 112}" cy="66" r="14" fill="var(--fg)"/><text x="${30 + i * 112}" y="72" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">${i + 1}</text>`).join('');
	extra += `<rect x="236" y="186" width="220" height="100" rx="12" fill="var(--fg)" fill-opacity=".1"/><text x="252" y="216" font-size="16" fill="var(--ink)" font-family="var(--mono)">1 Button \u201cSave\u201d</text><text x="252" y="244" font-size="16" fill="var(--ink)" font-family="var(--mono)">2 Button \u201cPrint\u201d</text><text x="252" y="272" font-size="16" fill="var(--ink)" font-family="var(--mono)">3 Button \u201cShare\u201d</text>`;
	return `<svg viewBox="0 0 480 310" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${win}${buttons}${[0, 1].map(i => `<rect x="30" y="${136 + i * 38}" width="${[180, 150][i]}" height="16" rx="8" fill="var(--tint)"/>`).join('')}${extra}</svg>`;
}

/** A small chat app (for `mirror`): a sidebar, three messages and a text box; diff marks one small difference in red. */
function mirrorApp(diff) {
	let t = `<rect x="0" y="0" width="520" height="330" rx="20" fill="#fff"/><path d="M 20 0 H 500 Q 520 0 520 20 V 40 H 0 V 20 Q 0 0 20 0 Z" fill="var(--fg)" fill-opacity=".16"/>`;
	t += [0, 1, 2].map(i => `<circle cx="${24 + i * 20}" cy="20" r="6" fill="var(--fg)" fill-opacity=".5"/>`).join('');
	t += `<rect x="0" y="40" width="140" height="290" fill="var(--fg)" fill-opacity=".07"/>`;
	t += [0, 1, 2, 3].map(i => `<rect x="18" y="${64 + i * 36}" width="${[100, 84, 92, 70][i]}" height="14" rx="7" fill="var(--fg)" fill-opacity=".25"/>`).join('');
	t += `<rect x="300" y="62" width="196" height="40" rx="14" fill="var(--fg)" fill-opacity=".85"/>`;
	t += `<rect x="164" y="118" width="250" height="56" rx="14" fill="var(--fg)" fill-opacity=".14"/>`;
	t += `<rect x="330" y="190" width="166" height="40" rx="14" fill="var(--fg)" fill-opacity=".85"/>`;
	t += `<rect x="164" y="270" width="332" height="40" rx="20" fill="var(--fg)" fill-opacity=".1"/><circle cx="472" cy="290" r="13" fill="var(--fg)" fill-opacity="${diff ? '.35' : '.85'}"/>`;
	if (diff) {
		t += `<circle cx="472" cy="290" r="30" fill="none" stroke="var(--red)" stroke-width="4"/>`;
	}
	return `<svg viewBox="0 0 520 330" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${t}</svg>`;
}
