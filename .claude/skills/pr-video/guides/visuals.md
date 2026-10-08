# Building the visuals

`prs direct` writes `scenes.js` with one catalog treatment per beat, chosen for the beat's need and away from
what recent videos used. Your job is the content: fill every `TODO` from the PR, set the times, look, fix.
All layout is automatic: there are no pixel positions to set.

## scenes.js

```js
import { defineVideo, word, cue } from '../../engine/scene.js';
import { label, fact, quote, ident, code, path } from '../../engine/text.js';
import { title, concept, exchange, status } from '../../catalog/index.js';

export default defineVideo({
	motion: 'slides',               // chosen by prs direct: slides | canvas (layout: row | column | grid) | morph
	beats: {
		title: title.frame({ headline: label('Authenticate to a locked Private Marketplace') }),
		problem: concept.mismatch({ eyebrow: label('The problem'), title: label('...'), ... }),
		...
	},
});
```

Beat keys are the storyboard ids, in the same order. The code treatments are imported as
`code as codeSlides` (`codeSlides.diff(...)`), because `code` is already the `code()` helper below.

## Text: say where it comes from

| Helper | For | Checked against |
| --- | --- | --- |
| `label('...')` | your words: titles, captions of boxes | the reviewer (numbers in labels are flagged) |
| `fact('additions', { format: 'n' })` | PR numbers and names (`pr.json` facts) | must exist |
| `quote('contact your administrator')` | exact text of the PR: body, commits, diff, tests | must be an exact substring |
| `ident('isSameSecureOrigin()')` | names in the code | must appear in the diff or changed files |
| `path('src/vs/.../file.ts')` | a changed file (basename shown; `{ show: 'full' \| 'dir' \| 'tail2' }`) | must be changed by the PR |
| `code(file, { from, to })` | source lines at the head commit | fetched and verified |

Mix parts in an array: `[label('GET '), ident('/.well-known/oauth-protected-resource')]`.
`code()` is never text: in a text param, show a file with `path(file)` and a name with `ident(name)`. `ident`
accepts names in the diff or anywhere in the PR's changed files at the head commit; `quote` ignores Markdown markers
in the PR description.
Code forms: `code(file, { from: 195, to: 222 })`, `code(file, { anchor: 'private async fetchManifest\\(' })`
(one line, for "start reading here"), `code(file, { anchor: '...', block: true })` (the whole function), and
`code(file, { diff: true, anchor: '...' })` (the diff hunk containing the anchor, for `code.diff`).

## Time: land each thing on its word

Any `at` (and `replyAt`, `badgeAt`, `tagAt`...) takes:

- a cue name from the storyboard: `'step2'`
- `cue('step2', 0.4)`: a cue plus seconds
- `word('401')`, `word('resource.', { offset: -0.5 })`, `word('the', { nth: 2 })`: when that word is spoken
- a number: seconds after the beat starts

Leave `at` out and items spread evenly over the beat. Set it for anything the narration names.

## Motion

- `slides`: one slide per beat; the outgoing slide is gone before the next appears.
- `canvas`: beats are panels on one board and the camera flies between them (`layout: 'row' | 'column' | 'grid'`).
  The panels share the look; the board's dots and edges show only while moving.
- `morph`: slides, plus one object that flies from beat to beat: `carry: { text: label('bearer token'), icon: 'key',
  anchors: { problem: 'have', fix: 'reply3' } }`. It flies between consecutive beats that both have an anchor.
  Anchors: `concept.mismatch` `have`, `need`; `exchange.lifelines` `request1..n`, `reply1..n`;
  `architecture.map` `chip`. Pick anchors that are on screen when their beat starts (a card head, not a reply
  that appears 15 seconds later). Use morph only when one thing really travels through the story.

## Look before you trust it

- `prs stills` (or `--beat <id>`, `--at 12.3,14`) and open `build/stills/contact.png`, then the frames that
  matter. Check: does each picture match the sentence it is under? Does every highlight land on its word? Is
  anything crowded, cut, tiny or empty?
- `prs lint` checks every frame for text outside its box, clipped text, overlapping text, text in the caption
  band, text without provenance, the end card's QR, and repetition of recent videos.

## When the catalog doesn't fit

1. Try another treatment for the same need (`prs catalog`, `catalog.md`): `prs direct --use beat=treatment --reason "..."`.
2. If none can show it, add a treatment in `catalog/<need>.js`: `defineTreatment({ id, need, name, when, params,
   demo, mount, render })`, using `theme/primitives.js` (cards, pills, arrows, connectors, icons) and `txt()` for
   every string. Give it a demo, run `prs catalog --stills` (it lints all demos and refreshes `catalog.md`), and
   look at its still. New treatments make every later video richer; one-off pixel work doesn't.

Icons: Fluent names listed in `theme/icons.js` (`key`, `lock`, `server`, `globe`, `laptop`, `building`, `shield`,
`beaker`, `branch`, `bug`, `rocket`, `settings`, `extension`, `window`, `terminal`...).
