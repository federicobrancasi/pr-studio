# A deck's own designs

When no built-in layout can show an idea, draw it. A design is a function that returns the HTML of one slide; it lives
with the deck, so it can't change any other deck. The example to copy: `deck/samples/designs/samples.mjs`
(`samples-build`, the last slides of the samples).

## The file

`decks/<slug>/designs/<anything>.mjs`:

```js
// Designs of the <slug> deck. One design draws one slide.
//   offline-queue: a conveyor belt of edits waiting for a signal, the oldest at the front
export function designs({ heading, body, bodyHeight, W, ic, pill, fmt, esc, r1, arrowHead }) {
	return {
		/** What it draws, in one line. Its fields: items: [{ title (<= 20), tone }], ... */
		'offline-queue': {
			css: `
.offline-queue { position: relative; }
.offline-queue .oq-item { position: absolute; border-radius: 20px; background: var(--tint); color: var(--fg); }
`,
			render(s, ctx) {
				const H = bodyHeight(s);
				return heading(s) + body(`<div class="offline-queue" style="width:${W}px;height:${H}px">…</div>`, { vcenter: false });
			},
		},
	};
}
```

The slide then says `layout: 'offline-queue'` and carries the design's own fields next to the usual ones (`id`,
`eyebrow`, `title`, `notes`, `sources`, `say`, `link`, `bg`). `render` may be `async`.

- **Name:** `<deck or topic>-<concept>`, lower case. It must not be the name of a built-in layout.
- **Helpers** (the argument of `designs`): `heading(s)`, `body(html, { vcenter })`, `bodyHeight(s)` (the height under
  the title; a `link` makes it shorter), `W` (1728, the width), `ic(name, size, colour)`, `iconTile(name, { tone, size,
  round, solid })`, `pill({ text, tone, icon })`, `logo(slug, size)`, `fmt` (inline markup), `esc`, `plain`, `r1`,
  `arrowHead(x2, y2, x1, y1, colour, width)`, `arrowSvg(width, colour)`, `stepTone(i)`, `qrSvg(text)`,
  `asset('assets/x.png')` (the `<img src>` of a picture in the deck's `assets/`, or null if it's missing) and `pngSize`.
- **CSS:** every selector starts with the design's class (`.offline-queue .oq-item`), so designs can't change each
  other. The build includes only the CSS of designs the deck uses.
- **Colours:** `var(--blue)`, `--green`, `--red`, `--orange`, `--yellow`, `--purple` and their `-tint`s, `--ink`,
  `--body`, `--muted`, `--line`, `--connector` (arrows), `--mono` (code font). A `t-<tone>` class sets `--fg` and `--tint`.
- **Text:** `data-t` on every element with text (SVG `<text>` too), so the build can check overflow and count words;
  `data-fit` on any box whose text could overflow it.
- **Never:** blurred `box-shadow`, `text-shadow` or `filter` (PDF viewers draw them as gray boxes; a sharp ring
  `box-shadow: 0 0 0 6px var(--fg)` is fine), gray fills or gray outlines, fonts or colours outside the theme.

## Click by click

A slide with `clicks: [{ caption, say }, …]` becomes one PDF page per click. The caption shows in a bar at the bottom,
with numbered dots; `say` goes into the notes. Only designs read the click: `ctx.step` is 1 on the first click.

- Draw the whole picture on every click and hide what comes later with the class `later` (`visibility: hidden`): it keeps
  its place, so nothing jumps.
- Give every element that appears or changes a `data-key`: the build warns if one moves between clicks.
- On each click, show what is new (a ring, a solid fill) and let what came before go quieter.
- Keep it to 3–6 clicks. The bar takes the bottom of the slide: draw within `bodyHeight(s)`.

## A good design

- **The idea is a picture:** what would you draw on a whiteboard to explain it? Draw that, not boxes with words in them.
- **It fills the page** under the title: no small diagram in a sea of white.
- **Few words, big:** the 25-word limit holds.
- **Shapes:** soft colour tints, white icon discs, one solid colour for the thing that matters; connectors go around text,
  never through it.

A menu of pictures, to pick from when a slide needs one:

- **Paper:** a receipt with line items and a total; a boarding pass; a passport with stamps; a contract with a highlighted
  clause; a report card; a sticky note on a monitor; a newspaper front page.
- **Places:** a metro map; a floor plan with locked doors; a road with guardrails; a maze; a fork in the road; a bridge; a
  security checkpoint; a turnstile.
- **Instruments:** a speedometer; a fuel gauge or battery; a thermometer; a scale with weights; a traffic light; a fuse
  box; an hourglass; a stopwatch.
- **Systems:** a conveyor belt with an inspector; slices of Swiss cheese whose holes line up; a chain with one weak link;
  dominoes; a relay baton; a photocopy of a photocopy.
- **Data:** a waffle chart of 100 squares; a slope graph; a dot plot; a heat-map calendar; a Sankey of where things go.
- **Screens:** a browser with its address bar; notifications on a lock screen; an inbox; a git graph; a pull request with
  its checks; a settings toggle.
- **Scenes:** a referee with a card; a podium; a tug of war; a stage with a spotlight; a whiteboard.
