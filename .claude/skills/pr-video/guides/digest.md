# The daily changelog digest

One video, about a minute long, of the top five picks of a #changelog report: a short intro, one chapter per pick in
the report's order, and an outro that recaps them. Each chapter shows **what changed for users**: on the left a
Before → Now strip, on the right the UI (a recording of VS Code, or a drawn scene), and while the narration talks
about a piece of UI, an arrow runs from its strip row to it. The player, the strip and the arrows are done; you write
the words and choose what to show.

## The steps

1. **The project.** `prs digest new --run <report run>` (or `--file report.md`) makes `videos/changelog-<date>/`:
   `brief.md` (the picks and where each PR's brief, diff and files are), `picks.json`, and skeletons of
   `storyboard.json` and `digest.json`. Each PR is downloaded in its own `videos/<owner>-<repo>-<number>/`. In CI the
   setup already ran it: continue from there.
2. **Facts.** For each pick, read its brief and diff, and write `videos/<slug>/facts.md`: what a user sees now, the
   UI strings exactly as in the diff (localized strings, setting IDs and descriptions, button labels, command
   titles), and the before → after **only when the diff shows both** (an old string replaced, a default flipped).
   Every word on screen comes from this file or the narration.
3. **Narration** (`storyboard.json`): beats `intro`, `c1` … `c5`, `outro`, about **150 words** in all.
   - intro: `Today's VS Code changelog: the top five changes from the last day.`
   - each chapter: 20-30 words, starting `One.` … `Five.`: the change for users, then one detail that matters (the
     setting that turns it off, the shortcut, what it warns about). Name the UI as it is labeled. No hype, no
     guesses, nothing the diff doesn't support.
   - outro: `That's today's changelog. The full list is in the changelog channel.`
   - then `prs voice <slug>` (the local voice: about a minute).
4. **The visual of each chapter** (`digest.json` → `visual`), see below: a demo when the change can be recorded,
   otherwise a scene. Record demos with `prs demo <id> --slug <slug>`, and look at each demo's `contact.png`.
5. **The strip, the links and the timing** in `digest.json`, then `prs digest check <slug>` until it passes.
6. `prs digest stills <slug>`: look at its contact sheet **once**, fix what is wrong, then `prs digest render <slug>`.
   It delivers the mp4, its captions, `contact.png` and `<slug>.json` to the delivery folder (`PRS_DELIVER`).

## Demo or scene

**A demo** records VS Code doing it: the most convincing, when it works. It runs in a fresh profile of the build in
`PRS_VSCODE` (VS Code Insiders of the day), with a small workspace you choose. In CI the window is **signed out**,
with **no network**: no Copilot chat or agent sessions, no Agents window, no marketplace, no GitHub, no extensions.
What works: the editor, settings, the Command Palette, keybindings, views, the Welcome page, dialogs, notifications,
`vscode-insiders://` links opened in the window, terminals. A change is demoable when a signed-out user in a fresh
window can see it.

**A scene** draws the UI the change is about, from the PR's real strings: when the change needs a sign-in, the
network, an extension, another OS or the Stable build, or when the demo doesn't show it. `prs digest scenes` lists
them with their params and targets:

| Scene | For |
|-------|-----|
| `button-swap` | a page whose button changes (Welcome page, a banner, an empty view) |
| `list-actions` | a list row whose actions change (a new or moved button, a hover action, a nested row) |
| `app-badge` | the app icon in the dock with a badge (application badges, attention counts) |
| `slash-menu` | a chat input with a slash command and its suggestions |
| `dialog` | a modal dialog (a confirmation, a warning) |
| `setting` | a setting whose default or value changes, or a new setting |
| `command-palette` | the Command Palette with a new or renamed command, or a new keybinding |
| `notification` | a notification toast and its actions |

Never fake a recording: a scene is a drawing, and that's fine. Never draw what the PR doesn't show either.

## Demo scripts

`videos/<slug>/demos/<id>.mjs` (an ES module; use the chapter's id, e.g. `c5`). `prs demo <id> --slug <slug>` runs it
in VS Code, records the window and writes `build/demos/<id>/`: `demo.json`, `clip.mp4`, and `contact.png` (stills
with every mark drawn on them). The script:

```js
export const files = { 'README.md': '# My project\n' };    // the workspace (optional)
export const settings = { 'editor.minimap.enabled': false };  // user settings (optional)
export async function setup({ page, run }) { }              // before the recording starts (optional)
export default async function demo({ page, run, openUrl, click, moveTo, type, press, sleep, mark, step, scheme }) {
	const dialog = page.locator('.monaco-dialog-box').filter({ hasText: 'Install Plugin' });
	mark('dialog', dialog);                                   // where it is, and when it is on screen
	mark('primary', dialog.getByRole('button', { name: 'Install' }));
	mark('warning', dialog, { text: 'Plugins can run code on your machine.' }); // the box of a sentence inside it
	await openUrl(`${scheme}://chat-plugin/install?source=owner/repo&plugin=name`);
	await dialog.waitFor({ state: 'visible' });
	step('dialog');                                           // a moment worth a still
	await sleep(2500);
	await click(dialog.getByRole('button', { name: 'Cancel' }));
}
```

- `run('Command: Title')` types a command into the Command Palette, as a user would. `openUrl(url)` opens a
  `vscode-insiders://` link in the window. `click(locator)` moves the cursor there, then clicks. `type(text)` types.
- `mark(name, locator, { text })` follows that UI for the whole recording: give each mark a locator that matches only
  its UI (filter by its text). Marks are what arrows point at.
- Slow enough to read: pause about 1.5 s on what matters. A demo of 8-15 s is plenty.
- Never change anything outside the throwaway profile: cancel install and sign-in dialogs.
- **Check its contact sheet**: is the change on screen, and is each mark's box on the right UI? If the demo fails
  twice, or doesn't show the change, use a scene and write why in `notes.md`.

## digest.json

Times: a phrase of the chapter's narration (`"Sign in to GitHub"`: when it is spoken), seconds into the chapter
(`0.35`), `{ "cue": "phrase", "offset": 0.3 }`, `{ "mark": "dialog", "edge": "start"|"end", "offset": 0 }` (when a
demo's mark is on screen), or `{ "step": "label" }`. Any key named `at`, `from`, `until` or ending in `At` is a time.

A chapter with a scene (Oct 19, #342442):

```json
"c1": {
	"pick": 1,
	"headline": "Signed out? The Welcome page offers GitHub sign-in",
	"eyebrow": "When you're signed out",
	"before": { "at": "When", "rows": [{ "id": "old", "style": "chip", "icon": "chat", "text": "Try out the new Agents window" }] },
	"now": { "at": "Sign in to GitHub", "rows": [{ "id": "new", "style": "chip", "icon": "github", "text": "Sign in to GitHub" }] },
	"setting": { "name": "chat.welcomePage.signIn.enabled", "state": "On by default", "at": "A setting" },
	"visual": { "scene": { "name": "button-swap", "params": {
		"tab": "Welcome", "swapAt": "Sign in to GitHub",
		"before": { "text": "Try out the new Agents window", "icon": "chat" },
		"after": { "text": "Sign in to GitHub", "icon": "github" } } } },
	"links": [
		{ "row": "old", "target": "before", "until": { "cue": "Sign in to GitHub", "offset": 0.1 }, "tone": "neutral" },
		{ "row": "new", "target": "after", "from": { "cue": "Sign in to GitHub", "offset": 0.95 } }
	],
	"recap": { "before": "Try out the new Agents window", "now": "Sign in to GitHub" }
}
```

A chapter with a demo (Oct 19, #342430): no verified before, so "before" lists the two links instead.

```json
"c5": {
	"pick": 5,
	"headline": "Plugin links that ask before they act",
	"eyebrow": "VS Code links",
	"before": { "head": "Link", "icon": "link", "at": { "cue": "links", "offset": -0.15 }, "dim": false, "rows": [
		{ "id": "l1", "text": "Add a plugin marketplace", "sub": "chat-plugin/add-marketplace", "at": { "mark": "dialog1" } },
		{ "id": "l2", "text": "Install a plugin", "sub": "chat-plugin/install", "at": "or install a plugin" } ] },
	"now": { "head": "Asks first", "icon": "shield", "at": { "mark": "dialog1", "offset": 0.3 }, "pulseAt": "asks first", "rows": [
		{ "id": "a1", "style": "button", "tone": "blue", "text": "Add Marketplace" },
		{ "id": "a2", "style": "button", "tone": "blue", "text": "Add Marketplace and Install", "at": { "mark": "dialog2" } },
		{ "id": "warn", "tone": "orange", "icon": "warning", "text": "Plugins can run code on your machine.", "at": { "cue": "plugins can run code", "offset": -0.1 } } ] },
	"visual": { "demo": "c5" },
	"clip": {
		"anchors": [
			{ "at": "add a plugin marketplace", "clip": { "mark": "dialog1" } },
			{ "at": "and for installs", "clip": { "mark": "dialog2" } } ],
		"end": { "mark": "dialog2", "edge": "end", "offset": -0.15 } },
	"camera": [{ "at": 0.35, "dur": 1.0, "zoom": 1.41, "fx": 614, "fy": 256 }],
	"links": [
		{ "row": "a1", "target": "dialog1.primary", "stop": "dialog1", "tone": "blue", "pad": 5 },
		{ "row": "a2", "target": "dialog2.primary", "until": "plugins can run code", "stop": "dialog2", "tone": "blue", "pad": 5 },
		{ "row": "warn", "target": "dialog2.warning", "from": { "cue": "plugins can run code", "offset": 0.05 }, "stop": "dialog2", "tone": "orange", "thin": true, "pad": 1 } ],
	"recap": { "before": null, "now": "Plugin links that ask first" }
}
```

- **headline**: what changed for users, under 52 characters. **eyebrow** (optional): where it happens.
- **before** (only a verified before) and **now**: `at` (when the head appears; for now, the phrase that states the
  change), `rows`, and optionally `head`, `icon`, `tone`, `pulseAt`, `dim: false`. Rows: `id`, `text` (about 30
  characters; `sub` for a second line), `style` (`chip`: a dark button with `icon`, `"github"` for the GitHub mark;
  `button`: a blue button), `icon`, `mono` (code), `kbd` (a shortcut), `toggle` (`on`, `off`, `flip`), `tone`
  (`orange` for a warning), `changed: false` (a now row that is not new: plain), `at`. Now rows are green by default.
- **setting** (optional): `{ name, state, at }`, the setting card under the strip.
- The strip must fit 675 px: about 7 rows with heads (`prs digest check` measures it).
- **links**: `{ row, target, from, until }`: an arrow from a strip row to a target (a scene's target, or a demo's
  mark), from `from` (default: just after the row appears) until `until` (default: the chapter's end; a demo's mark
  only while it is on screen). Options: `tone` (green, blue, orange, neutral), `pad` (the ring around the target),
  `stop` (the arrow stops at that target's edge: a dialog), `also` (stops below it: a tooltip), `route` (`h`, `up`,
  `down`, `lane`), `round`, `thin`. One or two links per chapter, each while the narration names that UI.
- **visual**: `{ "demo": "c5" }` or `{ "scene": { "name": "...", "params": { ... } } }` (times in params too).
- **clip** (demos): `anchors` pin moments of the recording to the narration (the recording plays faster or slower
  between them), `end` stops it (it holds its last frame), `after` is the speed after the last anchor.
- **camera** (demos): zoom moves `{ at, dur, zoom, fx, fy }` (fx, fy in the 1280×720 window) or `{ at, zoom, focus:
  "mark" }`. Zoom 1.3-1.9 on the UI that changed; not on a scene.
- **recap**: the outro's line, `{ before, now, mono }`: `before: null` shows "New".

## Before you render

- Every string on screen is in `facts.md`; every before → after is shown by the diff.
- The headline, the strip and the narration say the same thing.
- Each arrow lands on the right UI in the stills (rings around the thing, not next to it).
- 55-65 s in all (`prs digest check` prints the length of each chapter); no chapter is silent for long.

## Runs nobody watches

The daily job in GitHub Actions: nobody reads your messages until it's over, and nobody answers questions.

- **Don't ask questions.** When something is unclear, decide, and write the decision in one line in
  `videos/<slug>/notes.md`.
- **Time:** aim for 40 minutes, stop at 60. When the same step fails twice the same way (a demo, a check, the
  render), write what failed and the error in `notes.md`, and take the fallback: a scene instead of a demo.
- **Look once:** open each demo's contact sheet and the stills' contact sheet, not every frame.
- **Leave pr-studio as it is:** no commits, and no changes to the CLI, the player, the scenes or the guides. If
  something in them is broken, say so in `notes.md`.
- **No internet** (`PRS_OFFLINE`): the report and every PR were downloaded before you started; everything comes from
  `videos/`.
- End with a two-line summary: the video's path and length, and which chapters are demos.

