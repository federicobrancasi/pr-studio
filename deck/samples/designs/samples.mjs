// The samples deck's own design: how a deck draws a slide no built-in layout can, and how a slide builds up click by
// click. Copy its shape for your own designs (see "A deck's own designs" in the guide of the generate-presentation skill).
//   samples-build: three cards that appear one per click, each joined to the last by an arrow
export function designs({ fmt, ic, heading, body, bodyHeight, W }) {
	return {
		/** Three cards that appear one per click; the newest has a ring. cards: [{ icon, title (<= 20), text (<= 40), tone }].
		 * The slide has one click per card: clicks: [{ caption, say }]. */
		'samples-build': {
			css: `
.samples-build { position: relative; display: flex; align-items: center; justify-content: space-between; }
.samples-build .sb-card { width: 470px; padding: 40px 40px 44px; border-radius: 28px; background: var(--tint); color: var(--fg); }
.samples-build .sb-card .t { margin-top: 24px; font-size: 40px; font-weight: 700; letter-spacing: -.01em; color: var(--ink); }
.samples-build .sb-card .s { margin-top: 10px; font-size: 28px; line-height: 1.3; color: var(--body); }
.samples-build .sb-card.now { box-shadow: 0 0 0 6px var(--fg); }
.samples-build .sb-arrow { color: var(--connector); }
`,
			render(s, ctx) {
				// Without steps the slide shows its last state.
				const step = ctx.step ?? s.cards.length;
				const parts = s.cards.map((c, i) => {
					const shown = i < step;
					const card = `<div class="sb-card t-${c.tone ?? 'blue'}${i === step - 1 ? ' now' : ''}${shown ? '' : ' later'}" data-key="card-${i}" data-fit>${ic(c.icon, 60)}<div class="t" data-t>${fmt(c.title)}</div><div class="s" data-t>${fmt(c.text)}</div></div>`;
					const arrow = i ? `<div class="sb-arrow${shown ? '' : ' later'}" data-key="arrow-${i}">${ic('arrowRight', 64)}</div>` : '';
					return arrow + card;
				}).join('');
				return heading(s) + body(`<div class="samples-build" style="width:${W}px;height:${bodyHeight(s)}px">${parts}</div>`);
			},
		},
	};
}
