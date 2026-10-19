// The Settings editor showing one setting, searched by its ID, whose value (default) flips: the most common changelog
// change ("now on by default", "a new setting").
import { esc, iconSlot, fillIcons, sceneRect, vscodeWindow, ramp, standard, clamp } from './chrome.js';

/** The title VS Code's Settings editor shows for a setting ID: chat.copilot.imageGeneration.enabled → "Chat › Copilot › Image Generation: Enabled". */
export function settingTitle(id) {
	const parts = String(id ?? '').split('.').map(s => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()));
	return parts.length > 1 ? `${parts.slice(0, -1).join(' › ')}: ${parts.at(-1)}` : parts[0] ?? '';
}

export default {
	name: 'setting',
	doc: 'The Settings editor with one setting whose default (or value) changes, or a new setting.',
	params: {
		id: 'the setting ID, e.g. "chat.welcomePage.signIn.enabled"',
		title: 'leave it out: VS Code\'s own title, from the ID ("Chat › Welcome Page › Sign In: Enabled"). Another title must be the PR\'s',
		description: 'its description (quote the PR exactly)',
		kind: '"checkbox" (default) or "text"',
		before: 'the value before: true/false for a checkbox, a string for text (optional for a new setting)',
		after: 'the value now',
		flipAt: 'time the value changes',
		badge: 'a small label beside the title, e.g. "Default changed" or "New" (optional)',
	},
	targets: ['row', 'value', 'description'],
	windows(p, { start, end }) {
		return { row: [start, end], value: [start, end], description: [start, end] };
	},
	/** The setting's ID, its description, and a title other than VS Code's own (derived from the ID). */
	proofs: p => [
		{ param: 'id', text: p.id },
		...(p.description ? [{ param: 'description', text: p.description }] : []),
		...(p.title && p.title !== settingTitle(p.id) ? [{ param: 'title', text: p.title }] : []),
	],
	build(host, p, ctx) {
		const { page } = vscodeWindow(host, { tab: 'Settings', tabIcon: 'settings' });
		const title = p.title ?? settingTitle(p.id);
		const value = p.kind === 'text'
			? `<span class="st-text"><span class="old">${esc(p.before ?? '')}</span><span class="new">${esc(p.after ?? '')}</span></span>`
			: '<span class="st-check"><i></i></span>';
		page.innerHTML = `
			<div class="st-search">${iconSlot('search', 22, '#8b8b8b')}<span>${esc(p.id)}</span></div>
			<div class="st-tabs"><span class="on">User</span><span>Workspace</span></div>
			<div class="st-row"><div class="st-title">${esc(title)}${p.badge ? `<span class="st-badge">${esc(p.badge)}</span>` : ''}</div>
				<div class="st-body">${p.kind === 'text' ? '' : value}<div class="st-desc">${esc(p.description ?? '')}</div></div>
				${p.kind === 'text' ? `<div class="st-input">${value}</div>` : ''}
				<div class="st-id">${esc(p.id)}</div></div>`;
		fillIcons(page);
		const row = page.querySelector('.st-row'), check = page.querySelector('.st-check'), text = page.querySelector('.st-text');
		const rects = { row: sceneRect(row, host, ctx.view), description: sceneRect(page.querySelector('.st-desc'), host, ctx.view) };
		rects.value = sceneRect(check ?? page.querySelector('.st-input'), host, ctx.view);
		return {
			rects,
			render(t) {
				const q = p.flipAt === undefined ? 1 : standard(clamp((t - p.flipAt) / 0.35));
				if (check) {
					const before = p.before === undefined ? !p.after : !!p.before;
					const v = before === !!p.after ? (p.after ? 1 : 0) : (p.after ? q : 1 - q);
					check.style.background = v > 0.5 ? '#0078d4' : '#313131';
					check.style.borderColor = v > 0.5 ? '#0078d4' : '#5a5a5a';
					check.firstElementChild.style.opacity = v.toFixed(3);
				}
				if (text) {
					text.querySelector('.old').style.opacity = (1 - q).toFixed(3);
					text.querySelector('.new').style.opacity = q.toFixed(3);
				}
				row.style.boxShadow = p.flipAt === undefined ? 'none' : `inset 3px 0 0 rgba(0, 120, 212, ${(ramp(t, p.flipAt, 0.3)).toFixed(3)})`;
			},
		};
	},
};
