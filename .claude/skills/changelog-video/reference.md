# Reference: the files of a changelog video

The workflow is in [SKILL.md](SKILL.md). This is what the files say and what the tools do.

## The project

`videos/changelog-<date>/`:

| File | Who | What |
|------|-----|------|
| `brief.md`, `picks.json`, `report.md` | `prs digest new` | the picks, each PR's brief, diff and files, and the build the demos record (`picks.json` `build`) |
| `facts.md` | you | per pick: what a user sees now, its UI strings exactly as in the diff |
| `storyboard.json` | you | the narration: beats `intro`, `c1` … `c5`, `outro` |
| `digest.json` | you | the chapters: the strip, the visual, the arrows |
| `demos/<id>.mjs` | you | the recordings |
| `notes.md` | you | one line per decision nobody was there to make |

Each PR is downloaded in its own `videos/<owner>-<repo>-<number>/` (`brief.md`, `pr.diff`, `pr.json`, its files).
Output: `build/demos/<id>/` (each recording: `demo.json`, `clip.mp4`, `contact.png`, `screen.txt`) and
`build/digest/` (`timeline.json`, `review/`, the video).

**The build.** Demos record VS Code Insiders; when Insiders doesn't have the picks (a release week: Insiders comes
from the release branch), `prs digest new` builds VS Code from main as of the last pick (a few minutes, or one built
before), and `prs demo` uses it. `brief.md` says which.

**Signed in or not.** On a Mac, `prs demo` copies the signed-in profile of the same build (Insiders, or Code OSS for a
build from main) and prints whether the session works. In CI, and with a profile whose session expired, it runs
signed out: no Copilot chat, no agent sessions, and the Agents window is only a sign-in dialog (`openAgentsWindow()`
says so).

## Times

A time is a phrase of the chapter's narration (`"Sign in to GitHub"`: when it is spoken), seconds into the chapter
(`0.35`), `{ "cue": "phrase", "nth": 1, "offset": 0.3 }`, `{ "mark": "dialog", "edge": "start"|"end" }` (when a
demo's mark is on screen), or `{ "step": "label" }`. Any key named `at`, `from`, `until` or ending in `At` is a time.

## digest.json

A recorded chapter with three arrows (Oct 19, c4; its demo is [example/demos/c4.mjs](example/demos/c4.mjs)):

```json
"c4": {
	"pick": 4,
	"headline": "/fork, with a title or with a prompt",
	"eyebrow": "In Agent Host chats",
	"before": { "at": "In Agent Host chats", "rows": [{ "id": "old", "mono": true, "text": "/fork" }] },
	"now": { "at": "now takes", "rows": [
		{ "id": "plain", "mono": true, "text": "/fork", "changed": false },
		{ "id": "title", "mono": true, "text": "/fork <title>" },
		{ "id": "prompt", "mono": true, "text": "/fork prompt <prompt>" } ] },
	"visual": { "demo": "c4" },
	"focus": [
		{ "part": "prompt", "row": "prompt", "at": "takes a prompt" },
		{ "part": "title", "row": "title", "at": "or a title" },
		{ "part": "forked", "row": "title", "at": "like" } ],
	"proof": "Fork conversation and send a prompt",
	"recap": { "before": "/fork", "now": "/fork <title> · /fork prompt <prompt>", "mono": true }
}
```

A drawn chapter with two arrows, the first from a Before row (Oct 19, c1):

```json
"c1": {
	"pick": 1,
	"headline": "Signed out? The Welcome page offers GitHub sign-in",
	"eyebrow": "When you're signed out",
	"before": { "at": "When", "rows": [{ "id": "old", "style": "chip", "icon": "chat", "text": "Try out the new Agents window" }] },
	"now": { "at": "Sign in to GitHub", "rows": [{ "id": "new", "style": "chip", "icon": "github", "text": "Sign in to GitHub" }] },
	"setting": { "name": "chat.welcomePage.signIn.enabled", "state": "On by default", "toggle": "flip", "at": "A setting" },
	"visual": { "scene": { "name": "button-swap", "params": {
		"tab": "Welcome", "swapAt": "Sign in to GitHub",
		"before": { "text": "Try out the new Agents window", "icon": "chat" },
		"after": { "text": "Sign in to GitHub", "icon": "github" } } } },
	"focus": [{ "part": "before", "row": "old" }, { "part": "after", "row": "new" }],
	"recap": { "before": "Try out the new Agents window", "now": "Sign in to GitHub" }
}
```

A card (no arrow):

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
- **before** (only a before the diff shows) and **now**: `at` (when the head appears; for now, the phrase that states
  the change), `rows`, and optionally `head`, `icon`, `tone`, `pulseAt`, `dim: false`. The strip comes in top to
  bottom (Before just ahead of Now when the narration names Before after it). Rows: `id`, `text` (about 30
  characters; `sub` for a second line), `style` (`chip`: a dark button with `icon`, `"github"` for the GitHub mark;
  `button`: a blue button), `icon`, `mono` (code), `kbd` (a shortcut), `toggle` (`on`, `off`, `flip`), `tone`
  (`orange`: a warning; `blue`), `changed: false` (a Now row that is not new), `at`.
- **setting** (optional): `{ name, state, at, toggle }`, the setting card under the strip; `toggle`: `on`, `off`, or
  `flip` (it turns on). A toggle that flips, or Before and Now toggles that differ, say a default changed: only when
  the PR changes one (`prs digest check` looks in its diff).
- The strip must fit 675 px: about 7 rows with heads (`prs digest check` measures it).
- **visual**: `{ "demo": "c4" }` or `{ "scene": { "name": "...", "params": { ... } } }` (times in params too).
- **focus** (not on a card): the arrows, up to three, one at a time: `{ "part", "row", "at" }`, from the strip row
  `row` to `part` (a demo's mark, or a scene's part), from the phrase `at` (and once the row is in) until the next one
  starts. Each is drawn only while its part is on screen and still, and lasts at least 1 s (`prs digest check` says
  when one can't). Its color is its row's: grey from a Before row, blue from a button or a blue row, orange from a
  warning, green otherwise. `"focus": "after"` is one arrow from the first green Now row (or `focusRow`).
- **proof** (demos): the PR's text one of the arrows' marks shows on screen (a label, a description, a command title),
  not text the demo typed.
- **clip** (demos, optional): `start` / `end` trim the recording (seconds, or a moment such as when a mark shows). A
  demo paced with `cue()` needs neither.
- **recap**: the outro's line, `{ before, now, mono }`: `before: null` shows "New".

The camera moves in on the first arrow's part (as close as the first parts fit, at most 1.5x), and on to a later part
that is out of view. Nothing to set.

## Demo scripts

`videos/<slug>/demos/<id>.mjs` (an ES module; use the chapter's id). `prs demo <id> --slug <slug>` starts VS Code in
a throwaway profile with a small workspace, runs `setup()`, then records the window while the default export runs.

```js
export const files = { 'README.md': '# My project\n' };          // the workspace (optional)
export const settings = { 'workbench.startupEditor': 'none' };   // user settings (optional)
export async function setup(ctx) { }                              // before the recording (optional)
export default async function demo(ctx) { }                       // recorded
```

The helpers (`ctx`):

| Helper | What it does |
|--------|--------------|
| `run('Category: Title')` | runs a command from the Command Palette, typed as a user would |
| `palette(text)` | opens the Command Palette and types, without Enter; `picker()`, `pickerItem(label)`: the open quick pick and a row of it |
| `setting(id)` | opens the Settings editor on one setting; returns its row (found by ID, not by wording) |
| `openUrl(url)` | opens a `vscode://` (`scheme`) link in the window, as if clicked on a web page |
| `terminal(command)` | opens a terminal and runs a command; returns its text area |
| `chat.input()`, `chat.send(text)`, `chat.reply()` | the chat input of this window (the Chat view, an Agents window session, or its new-session input); send a prompt; wait for the reply |
| `openAgentsWindow()` | in `setup()` only: opens the Agents window, and the recording is of it; returns its helpers |
| `moveTo(locator)`, `click(locator)`, `type(text)`, `press(key)`, `sleep(ms)` | the mouse and the keyboard, as a user |
| `mark(name, locator, { text, tight })` | follows that UI through the recording (below) |
| `step(label)` | a moment worth a still (`{ "step": "label" }` in digest.json) |
| `cue(phrase, { nth, offset })`, `cue.end()`, `begin()` | keep the narration's pace (below) |

**Marks.** A mark counts as on screen only when it really is: in the window, not transparent, not covered. Give each
a locator that matches only its UI (filter by text only it shows). With `{ text }` it counts only while that text
shows in it; with `{ text, tight: true }` its box is the text's own (a sentence of a dialog), not the element's.
Prefer stable locators: `.setting-item-contents[data-key="<id>"]` (via `setting(id)`), `.monaco-dialog-box`,
`.quick-input-widget .monaco-list-row`, `.suggest-widget .monaco-list-row`, `.monaco-list-row` filtered by text,
`a.action-label[aria-label^="..."]`, `.monaco-hover`. `prs demo inspect <id>` prints the text on screen at the end of
a recording, with each element's class and box: use it when a locator doesn't match.

**Pacing.** `cue(phrase)` waits until the chapter's narration says the phrase: do each step at the words that
describe it, and the recording plays as recorded, in sync with the voice. The narration starts where the recording
starts (or at `begin()`); `cue.end()` waits until it ends, and the clip ends there (what the script does after, such
as cancelling a dialog, isn't shown). Record after `prs voice`; when the narration changes, record again
(`prs digest check` says so). A step that takes longer than the narration allows makes the next cue late (the check
says which): start it at an earlier cue.

**Agents window.** Open it in `setup()` and make what the recording needs there (a session: send a short, harmless
prompt and wait for the reply), so the recording starts on it:

```js
export async function setup({ openAgentsWindow, sleep }) {
	const agents = await openAgentsWindow();
	await agents.chat.send('Suggest a one-line tagline for a to-do list app. Reply with the tagline only.');
	await agents.chat.reply();
	await sleep(1500);
}
```

Session rows are `.monaco-list-row`; a row's actions show on hover; chat input placeholders are "Chat with Copilot"
(a session) and "Pitch your idea" (a new one); the slash menu is `.suggest-widget`.

**Rules.** Never change anything outside the throwaway profile: cancel install and sign-in dialogs, don't push, don't
sign in. `prs demo` stops when VS Code renders with the wrong fonts on Linux (Inter for the UI, DejaVu Sans Mono for
code): never work around it. Shortcuts: CI records VS Code on Linux, where a shortcut reads Ctrl+T, not ⌘T; next to a
recording, write a shortcut as the recording shows it.

## Scenes

A scene draws one VS Code piece from the PR's real strings. It draws only the UI its row below names, never another
one. The strings that show the change must be the PR's (`prs digest check` looks); example data around them (a file
name, a session title) can be made up. `prs digest scenes` lists every scene with its params, parts and the icons.

| Scene | For | Parts (focus) |
|-------|-----|---------------|
| `button-swap` | a page whose button changes (Welcome page, a banner, an empty view) | `before`, `after` |
| `list-actions` | a list row whose actions change (a new or moved button, a hover action, a nested row) | `row`, `action`, `tooltip`, `child` |
| `app-badge` | the app icon in the dock with a badge (application badges, attention counts) | `badge`, `tile` |
| `slash-menu` | a chat input with a slash command and its suggestions | `input`, `list`, `entry0`… |
| `picker` | a dropdown from a chat input button, or a quick pick: a new entry, a disabled one and its reason | `picker`, `button`, `item0`… |
| `dialog` | a modal dialog (a confirmation, a warning) | `dialog`, `title`, `highlight`, `primary`, `cancel` |
| `setting` | a setting: a default the PR changes (`before` → `after`), a new setting, a new description | `row`, `value`, `description` |
| `command-palette` | the Command Palette with a new or renamed command, or a new keybinding | `input`, `list`, `item0`… |
| `notification` | a notification toast and its actions | `toast`, `message`, `action0`… |
| `editor` | a file where text appears at the cursor (pasted, inserted): the PR's own example | `editor`, `inserted` |
| `card` | a change with no UI to show: the change in words, its setting or command (no focus) | |

A part exists only when its params draw it (a `tooltip` needs `tooltipAt`), and an arrow shows only while it is
drawn. A setting's value flips (`before`, `flipAt`) only when the PR changes its default.

**A card** (telemetry, a default applied behind the scenes, an internal rename): its title says the change for users,
its lines the details, its setting or command in mono. Say plainly in the narration what changes for users; if
nothing on screen changes, say so. Never record or draw another UI for it.
