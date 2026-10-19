# The daily changelog digest

One video, about a minute long, of the top five picks of a #changelog report: a short intro, one chapter per pick in
the report's order, and an outro that recaps them. Each chapter shows **what changed for users**: on the left a
Before → Now strip, on the right the UI (a recording of VS Code, a drawing of it, or a plain card). You write the
words and choose what to show; the arrow, the camera and the timing of the recording are computed.

**What is computed:** each chapter has at most **one arrow**, from its Now row to the one part of the UI that shows
the change (`focus`).
- It is drawn only while both are on screen: its row is in, and its target is there and has stopped moving (for a
  recording: only while the target shows the PR's text, the `proof`).
- The ring follows the target in every frame. There is no ring or arrow on anything that isn't there.
- A recording plays at one steady speed, and the camera moves in on the focus by itself.
- No focus, no arrow: a card never has one.

## The steps

1. **The project.** `prs digest new --run <report run>` (or `--file report.md`) makes `videos/changelog-<date>/`:
   `brief.md` (the picks and where each PR's brief, diff and files are), `picks.json`, and skeletons of
   `storyboard.json` and `digest.json`. Each PR is downloaded in its own `videos/<owner>-<repo>-<number>/`. In CI the
   setup already ran it: continue from there.
2. **Facts.** For each pick, read its brief and diff, and write `videos/<slug>/facts.md`: what a user sees now, the
   UI strings exactly as in the diff (localized strings, setting IDs and descriptions, button labels, command
   titles), and the before → after **only when the diff shows both**. Every word on screen comes from this file or
   the narration.
3. **Narration** (`storyboard.json`): beats `intro`, `c1` … `c5`, `outro`, about **150 words** in all.
   - intro: `Today's VS Code changelog: the top five changes from the last day.`
   - each chapter: 20-30 words, starting `One.` … `Five.`: the change for users, then one detail that matters. Name
     the UI as it is labeled. No hype, no guesses, nothing the diff doesn't support.
   - outro: `That's today's changelog. The full list is in the changelog channel.`
   - then `prs voice <slug>`.
4. **The visual of each chapter**: run `prs demo check` first (about 20 s). Then for each chapter:
   - **a demo** when a signed-out user in a fresh window can see the change: write `demos/<id>.mjs`, run
     `prs demo <id> --slug <slug>`, and look at its `contact.png`.
   - **a scene** when the UI can't be recorded (it needs a sign-in, the network, Stable, another OS).
   - **a card** when there is no UI to show.
   - If `prs demo check` fails (VS Code doesn't start, or renders with the wrong fonts), record nothing: scenes and
     cards, with the error in `notes.md`.
5. **`digest.json`**, then `prs digest check <slug>` until it passes. It checks the strings each visual shows against
   the PR, and that every arrow has something to point at, long enough.
6. **Review**: `prs digest stills <slug>`, open each `review-c*.png` at full size (below), fix what is wrong, then
   `prs digest render <slug>`. It delivers the mp4, its captions, `contact.png` and `<slug>.json` to `PRS_DELIVER`.

## Demo, scene or card

**A demo** records VS Code Insiders of the day (`PRS_VSCODE`) in a fresh profile, with a small workspace you choose.
In CI it is **signed out** and has **no network**: no Copilot chat or agent sessions, no Agents window, no marketplace,
no GitHub. What works: the editor, settings, the Command Palette, keybindings, views, dialogs, notifications,
`vscode-insiders://` links opened in the window, terminals. Settings changes almost always work (a new setting, a new
default, a new description).

**A demo proves itself:** its `focus` is a mark on the UI that shows the change, and its `proof` is text from the PR
that this mark shows on screen (a label, a setting's description, a command title).
- Text the demo types itself (a search for the setting ID) proves nothing.
- A recording that doesn't show the change (the chat view for a telemetry change) can't pass `prs digest check`: use
  a scene or a card.

**A scene** draws one VS Code piece from the PR's real strings. It draws only the UI its row below names, never
another one (a session list made to look like a model picker is a UI that doesn't exist). The strings that show the
change must be the PR's; example data around them (session titles, a file name) can be made up.
`prs digest scenes` lists every scene with its params, parts and the icons:

| Scene | For | Parts (focus) |
|-------|-----|---------------|
| `button-swap` | a page whose button changes (Welcome page, a banner, an empty view) | `before`, `after` |
| `list-actions` | a list row whose actions change (a new or moved button, a hover action, a nested row) | `row`, `action`, `tooltip`, `child` |
| `app-badge` | the app icon in the dock with a badge (application badges, attention counts) | `badge`, `tile` |
| `slash-menu` | a chat input with a slash command and its suggestions | `input`, `list`, `entry0`… |
| `dialog` | a modal dialog (a confirmation, a warning) | `dialog`, `title`, `highlight`, `primary`, `cancel` |
| `setting` | a setting whose default or value changes, or a new setting | `row`, `value`, `description` |
| `command-palette` | the Command Palette with a new or renamed command, or a new keybinding | `input`, `list`, `item0`… |
| `notification` | a notification toast and its actions | `toast`, `message`, `action0`… |
| `card` | a change with no UI to show: the change in words, its setting or command (no focus) | |

A part exists only when its params draw it (a `tooltip` needs `tooltipAt`, a `child` needs `child.at`), and the
arrow shows only while it is drawn.

**A card** (telemetry, a default applied behind the scenes, a behavior only a signed-in or managed session has, an
internal rename): its title says the change for users, its lines the details, its setting or command in mono. Say
plainly in the narration what changes for users; if nothing on screen changes, say so. Never record or draw another
UI for it.

**Shortcuts:** CI records VS Code on Linux, where a shortcut reads Ctrl+T, not ⌘T. Next to a recording, write a
shortcut as the recording shows it.

## Demo scripts

`videos/<slug>/demos/<id>.mjs` (an ES module; use the chapter's id, e.g. `c2`). `prs demo <id> --slug <slug>` runs it
in VS Code, records the window and writes `build/demos/<id>/`: `demo.json`, `clip.mp4`, and `contact.png` (stills
with each mark drawn where it is at that moment). A setting in the Settings editor:

```js
export default async function demo({ page, run, type, mark, step, sleep }) {
	await run('Preferences: Open Settings (UI)');
	const editor = page.locator('.settings-editor');
	await editor.waitFor({ state: 'visible' });
	await sleep(600);
	await type('chat.welcomePage.signIn.enabled', { delay: 25 });   // the search box has the focus
	// The row of the setting, by text only it shows (its description): not the search box, not "Commonly Used".
	const row = editor.locator('.setting-item-contents').filter({ hasText: 'GitHub sign-in button' }).first();
	mark('row', row);
	await row.waitFor({ state: 'visible' });
	step('setting');
	await sleep(2500);   // hold the change on screen: the arrow needs about 2 s of it, still
}
```

A dialog opened by a link (cancelled: never change anything):

```js
export default async function demo({ page, openUrl, click, mark, step, sleep, scheme }) {
	const dialog = page.locator('.monaco-dialog-box').filter({ hasText: 'Install Plugin' });
	mark('warning', dialog, { text: 'Plugins can run code on your machine.' });   // the dialog, while it shows this
	await openUrl(`${scheme}://chat-plugin/install?source=owner/repo&plugin=name`);
	await dialog.waitFor({ state: 'visible' });
	step('dialog');
	await sleep(2500);
	await click(dialog.getByRole('button', { name: 'Cancel' }));
}
```

- `run('Command: Title')` types a command into the Command Palette, as a user would. `openUrl(url)` opens a
  `vscode-insiders://` link in the window. `click(locator)` moves the cursor there, then clicks. `type(text)` types.
  `export const files = { ... }` and `export const settings = { ... }` set up the workspace and user settings;
  `export async function setup(ctx)` runs before the recording starts.
- `mark(name, locator, { text })` follows that UI through the recording. It counts as on screen only when it really
  is: in the window, not transparent, not covered by anything (and with `{ text }`, only while that text shows in it).
  The ring goes around the whole element: mark the UI that shows the change (the setting's row, the dialog, the
  button), with a locator that matches only it (filter by text only it shows), not a phrase inside it.
- The recording starts 1.2 s before the focus first shows (`clip.start` to start elsewhere): how the demo got there
  (the Command Palette, typing) is cut.
- Hold the change on screen 2-3 s, still. A demo of 8-15 s is plenty.
- Never change anything outside the throwaway profile: cancel install and sign-in dialogs.
- **Check its contact sheet**: is the change on screen, is the focus mark's box on the right UI, is the text readable?
  If the demo fails twice, or doesn't show the change, use a scene or a card and write why in `notes.md`.
- `prs demo` stops when VS Code renders with the wrong fonts on Linux (Inter for the UI, DejaVu Sans Mono for code).
  Never work around it.

## digest.json

Times: a phrase of the chapter's narration (`"Sign in to GitHub"`: when it is spoken), seconds into the chapter
(`0.35`), `{ "cue": "phrase", "offset": 0.3 }`, `{ "mark": "dialog", "edge": "start"|"end" }` (when a demo's mark is
on screen), or `{ "step": "label" }`. Any key named `at`, `from`, `until` or ending in `At` is a time.

A chapter with a scene:

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
	"focus": "after",
	"recap": { "before": "Try out the new Agents window", "now": "Sign in to GitHub" }
}
```

A chapter with a demo (no verified before, so "before" lists the two links):

```json
"c5": {
	"pick": 5,
	"headline": "Plugin links that ask before they act",
	"eyebrow": "VS Code links",
	"before": { "head": "Link", "icon": "link", "at": "links", "dim": false, "rows": [
		{ "id": "l1", "text": "Add a plugin marketplace", "sub": "chat-plugin/add-marketplace" },
		{ "id": "l2", "text": "Install a plugin", "sub": "chat-plugin/install", "at": "or install a plugin" } ] },
	"now": { "head": "Asks first", "icon": "shield", "at": "asks first", "rows": [
		{ "id": "warn", "tone": "orange", "icon": "warning", "text": "Plugins can run code on your machine." } ] },
	"visual": { "demo": "c5" },
	"focus": "warning",
	"focusRow": "warn",
	"proof": "Plugins can run code on your machine",
	"clip": { "end": { "mark": "warning", "edge": "end", "offset": -0.15 } },
	"recap": { "before": null, "now": "Plugin links that ask first" }
}
```

A chapter with a card:

```json
"c3": {
	"pick": 3,
	"headline": "Copilot chats count as interactive sessions",
	"now": { "at": "now count", "rows": [{ "id": "new", "icon": "chart", "text": "Interactive-user sessions" }] },
	"visual": { "scene": { "name": "card", "params": {
		"icon": "chart",
		"title": "Agent Host chats are interactive sessions",
		"lines": [{ "text": "For the runtime's interactive analytics" }, { "text": "Nothing changes on screen" }] } } },
	"recap": { "before": null, "now": "Interactive-user sessions" }
}
```

- **headline**: what changed for users, under 52 characters. **eyebrow** (optional): where it happens.
- **before** (only a verified before) and **now**: `at` (when the head appears; for now, the phrase that states the
  change), `rows`, and optionally `head`, `icon`, `tone`, `pulseAt`, `dim: false`. Rows: `id`, `text` (about 30
  characters; `sub` for a second line), `style` (`chip`: a dark button with `icon`, `"github"` for the GitHub mark;
  `button`: a blue button), `icon`, `mono` (code), `kbd` (a shortcut), `toggle` (`on`, `off`, `flip`), `tone`
  (`orange` for a warning), `changed: false` (a Now row that is not new), `at`. Now rows are green by default.
- **setting** (optional): `{ name, state, at }`, the setting card under the strip.
- The strip must fit 675 px: about 7 rows with heads (`prs digest check` measures it).
- **visual**: `{ "demo": "c5" }` or `{ "scene": { "name": "...", "params": { ... } } }` (times in params too).
- **focus** (optional; not on a card): the one part the arrow points to: a scene's part, or a demo's mark.
  **focusRow**: the Now row it starts from (default: the first green one). **proof** (demos): the PR's text the focus
  mark shows.
- **clip** (demos, optional): `start` / `end` trim the recording (seconds, or a moment such as when a mark shows).
- **recap**: the outro's line, `{ before, now, mono }`: `before: null` shows "New".

## Review

`prs digest stills` writes `review-c1.png` … `review-c5.png`: each chapter 1 s into its arrow (or in its middle).
Open **each one at full size** (the contact sheet is too small to judge), and fix what fails:

- Is the UI on the right the one the PR changes (a recording of it, a drawing of it, or a card), not another UI?
- Does the ring sit on the thing its row names? Is the text readable, nothing cut off or overlapping?
- Every string on screen is in `facts.md`; every before → after is shown by the diff.
- The headline, the strip and the narration say the same thing.
- 55-65 s in all (`prs digest check` prints the length of each chapter).

## Runs nobody watches

The daily job in GitHub Actions: nobody reads your messages until it's over, and nobody answers questions.

- **Don't ask questions.** When something is unclear, decide, and write the decision in one line in
  `videos/<slug>/notes.md`.
- **Time:** aim for 40 minutes, stop at 60. When the same step fails twice the same way, write what failed in
  `notes.md` and take the fallback: a scene or a card instead of a demo. When VS Code doesn't start at all
  (`prs demo check`), don't retry.
- **Look:** each demo's contact sheet, then the five review stills at full size.
- **Leave pr-studio as it is:** no commits, no changes to the CLI, the player, the scenes or the guides. If something
  in them is broken, say so in `notes.md`.
- **No internet** (`PRS_OFFLINE`): the report and every PR were downloaded before you started.
- End with a two-line summary: the video's path and length, and which chapters are demos.
