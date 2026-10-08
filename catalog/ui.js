// need: ui. Something the user sees: a notification, a message, a setting.
import { defineTreatment } from '../engine/scene.js';
import { C } from '../theme/tokens.js';
import { el, icon, pill, txt } from '../theme/primitives.js';
import { enter, prog, standard } from '../engine/motion.js';
import { label } from '../engine/text.js';
import { header, need } from './kit.js';

const SEVERITY = { error: { icon: 'error', color: '#e51400' }, warning: { icon: 'warning', color: '#bf8803' }, info: { icon: 'info', color: '#1a85ff' } };

/** A VS Code notification as the user sees it (light theme). */
function toast(parent, spec, { x, y, w }) {
	const sev = SEVERITY[spec.severity ?? 'info'];
	need(sev, `severity must be error, warning or info, not ${spec.severity}`);
	const box = el('div', 'st-abs', parent, { left: x, top: y, width: w, background: '#fff', borderRadius: 10, boxShadow: '0 0 0 1px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.16)', padding: '24px 26px 22px' });
	box.dataset.box = 'card';
	const row = el('div', '', box, { display: 'flex', gap: 16, alignItems: 'flex-start' });
	icon(row, sev.icon, 30, sev.color, { marginTop: 1 });
	const col = el('div', '', row, { flex: 1, minWidth: 0 });
	txt(col, spec.message, '', { display: 'block', fontSize: 25, lineHeight: 1.4, color: '#3b3b3b' }, 'div');
	if (spec.source) {
		txt(col, [label('Source: '), spec.source], '', { display: 'block', marginTop: 10, fontSize: 17, color: '#717171' }, 'div');
	}
	if (spec.actions?.length) {
		const actions = el('div', '', box, { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 });
		spec.actions.forEach((a, k) => {
			const btn = el('div', '', actions, { height: 40, padding: '0 18px', borderRadius: 4, display: 'flex', alignItems: 'center', fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap', background: k === 0 ? '#005fb8' : '#e5e5e5', color: k === 0 ? '#fff' : '#3b3b3b' });
			btn.dataset.box = 'pill';
			txt(btn, a);
		});
	}
	return box;
}

/** The notification the user got before vs the one they get now. */
export const toasts = defineTreatment({
	id: 'ui.toasts',
	need: 'ui',
	name: 'Notification before and after',
	when: 'The PR changes a message, error or prompt the user sees (and maybe what they can do about it).',
	params: {
		eyebrow: 'label', title: 'label',
		before: '{ severity: error|warning|info, message, source, actions: [labels], caption, at }',
		after: '{ severity, message, source, actions, caption, at }',
	},
	demo: () => ({
		eyebrow: label('What the user sees'), title: label('A way out instead of a dead end'),
		before: { severity: 'error', message: label('Access denied. Contact your administrator.'), source: label('Extensions'), caption: label('Before') },
		after: { severity: 'info', message: label('Sign in to access this marketplace.'), source: label('Extensions'), actions: [label('Sign In'), label('Cancel')], caption: label('Now') },
	}),
	mount(root, p, ctx) {
		const h = header(root, p, ctx);
		need(p.before && p.after, 'ui.toasts needs before and after');
		const make = (spec, x, tone) => {
			const frame = el('div', 'st-abs', root, { left: x, top: 270, width: 820, height: 480, borderRadius: 22, background: '#f3f3f3', overflow: 'hidden' });
			frame.dataset.box = 'tile';
			const bar = el('div', '', frame, { height: 44, background: '#e8e8e8', display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px' });
			for (const c of ['#ff5f57', '#febc2e', '#28c840']) {
				el('div', '', bar, { width: 13, height: 13, borderRadius: 7, background: c });
			}
			el('div', '', frame, { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: '#005fb8' });
			const t = toast(frame, spec, { x: 820 - 680 - 26, y: 0, w: 680 });
			const cap = el('div', 'st-abs', root, { left: x, top: 774 });
			pill(cap, { tone, text: spec.caption ?? label(tone === 'blue' ? 'Now' : 'Before'), size: 's' });
			return { frame, t, cap };
		};
		const before = make(p.before, 96, 'neutral');
		const after = make(p.after, 1004, 'blue');
		for (const side of [before, after]) {
			side.t.style.top = `${480 - 30 - 26 - side.t.offsetHeight}px`;
		}
		return { h, before, after, beforeAt: ctx.at(p.before.at, 0.8), afterAt: ctx.at(p.after.at, Math.max(1.6, ctx.beat.duration * 0.5)) };
	},
	render(i, t) {
		i.h.render(t);
		enter(i.before.frame, t, i.beforeAt - 0.3, { dy: 14 });
		enter(i.before.t, t, i.beforeAt, { dy: 24 });
		enter(i.before.cap, t, i.beforeAt + 0.2, { dy: 6 });
		enter(i.after.frame, t, i.afterAt - 0.3, { dy: 14 });
		enter(i.after.t, t, i.afterAt, { dy: 24 });
		enter(i.after.cap, t, i.afterAt + 0.2, { dy: 6 });
		const dim = standard(prog(t, i.afterAt, i.afterAt + 0.5));
		i.before.frame.style.opacity = String(Number(i.before.frame.style.opacity) * (1 - 0.35 * dim));
	},
});
