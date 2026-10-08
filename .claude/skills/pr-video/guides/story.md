# Writing the story

The viewer is someone who won't read the PR: an engineering manager, a reviewer deciding where to start, a
teammate catching up. After 40-100 seconds they should know what changes, why, how it works, what could break,
the status, and where to start reading. Technical words are fine; jargon without a picture is not.

## Length

`brief.md` gives the tier. It comes from the size outside tests, the number of areas, and whether the PR touches
security, protocols or compatibility. The narration runs at about 2 words per second, pauses included (both voices).

| Tier | Narration | Words | Beats |
| --- | --- | --- | --- |
| small | 40-55 s | 80-110 | 4: title, 2 explanation beats, status |
| medium | 60-80 s | 120-160 | 5: title, 3 explanation beats, status |
| large | 85-100 s | 170-200 | 6-7: title, 4-5 explanation beats, status |

`prs check` estimates the length; `prs voice` reports the real one. The window is for the narration: the end card
adds about 4 seconds to the file, and that doesn't count against the tier.

## Beats

Each beat is one idea, said in 15-40 words, with one diagram. It has:

- `id`: a short word (`problem`, `fix`, `rule`).
- `need`: what the beat has to show, which decides the kind of diagram:
  - `concept`: a problem, a mismatch, ideas side by side
  - `exchange`: messages between parties
  - `flow`: steps in order
  - `rules`: a rule applied to cases
  - `compare`: before and after
  - `architecture`: where it reaches
  - `code`: the lines themselves
  - `numbers`: sizes and measurements
  - `state`: a lifecycle
  - `ui`: something the user sees
  - `status`: scope, tests, what's open
- `say`: the narration. Plain sentences. Numbers from the PR as placeholders: `{{facts.additions}}`,
  `{{facts.changedFiles}}`, `{{facts.number}}`.
- `cues`: name -> a phrase from `say` where something should appear (`"step2": "Two"`), or
  `{ "phrase": "...", "nth": 1, "offset": -0.2 }`. Diagrams use these names as times.
- `claims`: every factual statement, with evidence. `prs check` verifies each piece:
  - `{ "file": "src/...ts", "anchor": "functionName" }`: the text (or regex) is in the file at the head commit
  - `{ "file": "src/...ts", "anchor": "old code", "removed": true }`: a line the PR removes
  - `{ "body": "exact words from the PR description" }` (Markdown markers like ** and backticks don't matter)
  - `{ "commit": "words from a commit message" }`, `{ "fact": "additions" }`, `{ "file": "...", "status": "added" }`
  Cite repository files or the PR itself, never pr-studio's own `brief.md` or `pr.json`.

The first beat is the title (fixed design). Keep its narration to the PR number, the author, what it does in a few
words, and the size:
`"Pull request {{facts.number}}, by {{facts.authorLogin}}: <what it does>. {{facts.additions}} lines added across {{facts.changedFiles}} files."`.
Add the state ("Still open for review.") if it matters. Cue names `author`, `stats` and `state` drive the title.

The last beat is the status: what is in scope, what follows separately, how it is tested, what is still open, and
1-3 places to start reading (functions, with `code(file, { anchor })` in the scene).

## Arcs that work

Pick the arc that fits the PR, then the needs follow:

- **Bug fix**: the symptom (concept/ui) -> the cause (code/flow/state) -> the fix (code/compare) -> how it's proven
  (status).
- **Feature**: the gap (concept) -> what it adds (ui/flow) -> how it works (exchange/architecture/code) -> limits
  and status.
- **Protocol or security change**: the gap (concept) -> the mechanism (exchange) -> the safety rule (rules) -> how
  far it reaches (architecture) -> status.
- **Refactor**: the old shape (architecture) -> the new shape (compare) -> why it's safe (rules/status).
- **Performance**: the cost (numbers) -> where it came from (flow/code) -> the change (compare) -> the
  measurement, quoted from the PR (numbers).
- **Build, infra, tests**: what runs where (flow/architecture) -> what changes (compare) -> impact (numbers/status).

## Style

- Say what the code does, not what the author "wants". Use the PR's names for things, once, then plain words.
- Short sentences that land on one picture each. Cue the words that change the picture.
- Numbers only from the PR, through placeholders or quoted from the body (then the screen shows `quote()`).
- Untested or claimed-only facts get "per the author" ("a manual run is still pending, per the author").
- No praise, no filler ("This PR introduces a robust..."), no ending summary; the status beat is the ending.

## Pronunciation

Captions show the text as written; the voice reads a spoken form. Code-like words get one automatically:
camelCase is split (`isSameSecureOrigin` -> "is same secure origin"), short acronyms are spelled (`IPC` ->
"I P C"), dotted names say "dot" (`product.json`), and long numbers are read digit by digit (PR numbers).
Anything else goes in `pronounce`, which wins over the automatic forms:

```json
"pronounce": {
  "325804": "three two five eight oh four",
  "mcumming": "M Cumming",
  "RFC 9728": "R F C ninety-seven twenty-eight",
  "getAuthorizationHeaders": "get authorization headers",
  "IPC": "I P C",
  "README": "read me"
}
```

Author logins are not names: map one to how it's said (`"mcumming": "M Cumming"`), or say "by its author" and
let the title frame show the login. Keep commas for real pauses only: the captions break and pause at them, and
the sync gate checks that the audio pauses there too.

## Example beat

```json
{
  "id": "negotiate",
  "need": "exchange",
  "say": "So VS Code asks at runtime, using RFC 9728. One: request the index. Two: on a 401 or 403, read the marketplace's well-known metadata for its authorization server and scopes. Three: get a token scoped to that resource. Four: retry. If step one works, nothing else runs.",
  "cues": { "rfc": "RFC 9728", "step1": "One", "step2": "Two", "step3": "Three", "step4": "Four", "skip": "If step one works" },
  "claims": [
    { "text": "a 401 or 403 from the service index is treated as 'authentication required'",
      "evidence": [{ "file": "src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts", "anchor": "statusCode === 401 || statusCode === 403" }] }
  ]
}
```
