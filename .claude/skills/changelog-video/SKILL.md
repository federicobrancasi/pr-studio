---
name: changelog-video
description: Use when making the daily VS Code changelog video (the top five picks of a #changelog report, in about a minute), by hand or in a run nobody watches (the daily job). Covers the project, the narration, recording VS Code and its Agents window, drawn scenes and cards, the arrows, the checks, the review and delivery.
---

# The daily changelog video

One video, about a minute long, of the top five picks of a #changelog report: an intro, one chapter per pick in the
report's order, an outro. It is a **product demo**: each chapter shows the change in VS Code itself whenever it can,
with a Before → Now strip on the left and arrows from the strip to the UI on the right.

**The standard is the Oct 19 video** ([example/](example/README.md)): three chapters recorded in VS Code (two of them
in the Agents window), two drawn; every arrow lands on what its row names, when the narration names it. Read the
example before you start, and make yours look like its review sheets.

Everything runs through the CLI, from the repo root: `node cli/prs.mjs <command>` (below: `prs`). The formats and
the helpers: [reference.md](reference.md).

## Record first

For each chapter, in this order:

1. **Record it** (a demo): VS Code doing the change, driven like a user. This is what the video is for. Most changes
   can be recorded: the Command Palette, quick picks, menus, hovers, dialogs, `vscode://` links, editors, terminals,
   views, settings; when `prs demo` runs signed in, also chat and the Agents window. Record the change itself: the
   command running, the menu open, the dialog up, the text pasted, the new button clicked. A Settings row is the
   change only when the change is the setting (a new setting, a new default, a new description); for a feature that
   has a setting, record the feature, and let the setting card (`setting` in digest.json) name the setting.
2. **Draw it** (a scene) when it can't be recorded here: it needs a sign-in the build doesn't have, another OS, an
   enterprise policy, the network, Stable.
3. **A card** only when there is no UI to show (telemetry, a default applied behind the scenes, an internal change).

Try a recording before you give up on it: when a locator doesn't match, `prs demo inspect <id>` shows the text on
screen. When the same recording fails twice the same way, draw the chapter and write why in `notes.md`.

## The steps

1. **The project.** `prs digest new --run <report run>` (or `--file report.md`) makes `videos/changelog-<date>/` and
   picks the build: VS Code Insiders, or VS Code built from main when Insiders doesn't have the picks (`brief.md`
   says which). In CI the setup already ran it: continue from step 2.
2. **Facts.** For each pick, read its brief and diff (search `pr.diff`; don't read it whole) and write
   `videos/<slug>/facts.md`: what a user sees now, its UI strings exactly as in the diff (labels, descriptions,
   setting IDs, command titles), and a before → after only when the diff shows both. Every word on screen comes from
   this file or the narration.
3. **What each chapter shows.** Decide record, draw or card (above), and the parts its arrows point at: up to three,
   one at a time, in the order the narration names them. One when the change is one thing; two or three when it is a
   sequence (Oct 19, c4: the `/fork prompt` entry, the `/fork <title>` entry, the forked session).
4. **Narration** (`storyboard.json`): beats `intro`, `c1` … `c5`, `outro`, about **150 words** in all.
   - intro: `Today's VS Code changelog: the top five changes from the last day.`
   - each chapter: 20-30 words, starting `One.` … `Five.`: the change for users, then one detail that matters,
     naming in order what its arrows point at. Name the UI as it is labeled. No hype, nothing the diff doesn't
     support.
   - outro: `That's today's changelog. The full list is in the changelog channel.`
   - then `prs voice <slug>`. The narration is final from here: the recordings follow its pace.
5. **Recordings.** `prs demo check` once (about 20 s; when it fails, record nothing: draw, and say why in
   `notes.md`). Then for each recorded chapter write `demos/<id>.mjs` and run `prs demo <id> --slug <slug>`:
   - do each step at the words that describe it, with `cue('phrase')`, and end with `await cue.end()`;
   - `mark()` each part an arrow points at, with a locator that matches only it;
   - open its `contact.png`: is the change on screen, is each mark's box on the right UI, is it readable?
6. **`digest.json`**, then `prs digest check <slug>` until it passes. It checks every string a chapter shows against
   its PR, that each arrow has its part on screen for at least a second after its phrase, and that the recordings are
   in sync with the narration. Its messages say what to change.
7. **Review** (below), then `prs digest render <slug>`: it delivers the mp4, its captions, `contact.png` and
   `<slug>.json` to `PRS_DELIVER`.

## A recording, step by step

Oct 19, c2 ([example/demos/c2.mjs](example/demos/c2.mjs)): "Two. In the Agents window, a session's first button is
now New Nested Session, replacing Pin. One click starts a new chat inside it."

```js
export async function setup({ openAgentsWindow, sleep }) {
	const agents = await openAgentsWindow();   // the recording is of the Agents window
	await agents.chat.send('Suggest a one-line tagline for a to-do list app. Reply with the tagline only.');
	await agents.chat.reply();                 // a session to show, made before the recording starts
	await sleep(1500);
}

export default async function demo({ page, moveTo, click, mark, step, cue }) {
	const rows = page.locator('.monaco-list-row').filter({ visible: true });
	const row = rows.filter({ hasText: /tagline|to-do/i }).first();
	const plus = row.locator('a.action-label[aria-label^="New Nested Session"]');
	const tooltip = page.locator('.monaco-hover, .workbench-hover').filter({ visible: true }).filter({ hasText: 'New Nested Session' }).first();
	const nested = rows.filter({ hasText: 'New Session' }).first();
	mark('tooltip', tooltip, { text: 'New Nested Session' });
	mark('nested', nested);
	await cue('a session\'s');          // the words, then the step they describe
	await moveTo(row, 20);              // hovering the row shows its actions
	await cue('first button');
	await moveTo(plus, 15);             // the tooltip names the button
	await tooltip.waitFor({ state: 'visible', timeout: 10_000 });
	step('tooltip');
	await cue('One click');
	await click(plus);
	await nested.waitFor({ state: 'visible', timeout: 15_000 });
	step('nested');
	await cue.end();                    // the clip ends with the narration
}
```

and its arrows: `"focus": [{ "part": "tooltip", "row": "nested" }, { "part": "nested", "row": "click", "at": "One
click" }]`, `"proof": "New Nested Session"`.

- Keep what an arrow points at on screen a second after its phrase. When the next step hides it (typing closes a
  menu), cue that step later: `await cue('or a title', { offset: 1.3 })` ([example/demos/c4.mjs](example/demos/c4.mjs)).
- A sentence of a dialog is a mark with `{ text, tight: true }` ([example/demos/c5.mjs](example/demos/c5.mjs)).
- The proof is the PR's text that one of the marks shows (a label, a description), never text the demo typed.
- Signed out (CI, or a profile whose session expired; `prs demo` prints which), there is no chat and no agent
  session, and `openAgentsWindow()` stops: draw those chapters.

## Review

`prs digest review <slug>` writes one sheet per chapter (`build/digest/review/c1.png` …): the chapter as it opens,
each arrow as it starts and while it holds, and as it ends, each frame with what should be on screen and the words
spoken then. It prints the checklist.

**Every sheet is checked, by a fresh pair of eyes.** Start a subagent for it (the task tool): give it the five
sheet paths, the checklist and `facts.md`, and ask it to open every sheet and list each frame where something is
wrong. It hasn't seen your work, so it judges what is on screen, and it costs little: don't skip it to save credits.
Only when your run can't start one, open all five sheets yourself, at full size. Fix what it finds, run
`prs digest check` and `prs digest review` again, and have the new sheets checked: two rounds at most, then render.
Write in `notes.md` what each round found.

On a sheet, a frame is wrong when:

- the UI on the right is not the one the PR changes (a recording of another UI, a drawing of a UI that doesn't
  exist);
- a ring is not on what its row names, or is on something not there yet, or the arrow comes before its part shows;
- what is said then is not what is on screen;
- next to a recording, the strip says something the recording doesn't show;
- something is cut off, overlapping or unreadable.

## Runs nobody watches

The daily job (GitHub Actions, or a local stand-in): nobody reads your messages until it's over, and nobody answers.

- **Don't ask questions.** When something is unclear, decide, and write the decision in one line in
  `videos/<slug>/notes.md`.
- **Time:** aim for 45 minutes, stop at 75. When the same step fails twice the same way, write what failed in
  `notes.md` and take the fallback (draw instead of record, a card instead of a scene). When VS Code doesn't start at
  all (`prs demo check`), don't retry.
- **Leave pr-studio as it is:** no commits, no changes to the CLI, the player, the scenes or the skills. If something
  in them is broken, say so in `notes.md`.
- **Write files with your file-editing tool**, not `sed -i`, heredocs or shell redirects: a run nobody watches can
  deny those.
- **No internet** in CI (`PRS_OFFLINE`): the report, every PR and the build were downloaded before you started.
- End with three lines: the video's path and length, which chapters are recordings (and in which window), and what
  the review found.
