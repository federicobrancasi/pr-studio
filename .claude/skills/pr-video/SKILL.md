---
name: pr-video
description: Use when the user wants a video that explains a pull request (a PR explainer, a review video, "make a video for <PR URL>"). Covers the whole workflow in this repo - fetching the PR, writing the narration, the voice, choosing and filling the diagrams, checks, rendering, the pr-director sign-off and delivery.
---

# PR video

A 40-100 second explainer of one pull request, for someone who won't read it (often a manager): what changes,
why, how it works, what is risky, the status, and where a reviewer should start. Technical but plain.
Everything runs through the CLI: `node cli/prs.mjs <command>` from the repo root, or
`node <path to pr-studio>/cli/prs.mjs <command>` from anywhere (below: `prs`).

## Start

- **The daily changelog digest** (one video of the top five picks of a #changelog report)? It is its own format:
  follow [guides/digest.md](guides/digest.md) instead of the workflow below.
- **Nobody watching** (a GitHub Actions job)? Read [guides/unattended.md](guides/unattended.md) first: no
  questions, a time limit, one review round, where the result goes.
- **Started from Slack (@GitHub, a cloud session)?** Read [guides/slack.md](guides/slack.md) first: triage, the
  59-minute budget, posting each video in the thread, and what not to do there.
- Once per machine: `prs doctor` (browser, voice model, Whisper, ffmpeg; it only adds what is missing).
- Then read [guides/story.md](guides/story.md) and [guides/visuals.md](guides/visuals.md). Skim
  [catalog.md](catalog.md) for the diagrams available.

## Workflow (aim for 15-20 minutes)

1. **Fetch.** `prs new <PR URL>` writes `videos/<slug>/`: `brief.md` (read all of it), `pr.diff` (search it for the
   lines you need; don't read it whole), `pr.json`, and a storyboard skeleton with the right number of beats.
2. **Story.** Write `videos/<slug>/storyboard.json`: one idea per beat, a `need` per beat, cues, and the claims with
   evidence ([guides/story.md](guides/story.md)). Run `prs check` until it says *ready for prs voice*.
3. **Voice, in the background.** Start `prs voice` (about a minute; MAI-Voice-2 when an Azure key is configured,
   otherwise the local Kokoro voice) and keep working while it runs.
4. **Direction.** `prs direct` picks a treatment for each beat and the motion for the video, writes
   `direction.json`, and scaffolds `scenes.js` with those treatments. Fill every TODO from the PR. Keep the picks:
   they are chosen to differ from recent videos. If one truly can't show its beat, re-pick it with
   `prs direct --use <beat>=<treatment> --reason "..."` (the reason is recorded and reviewed).
5. **Look.** `prs stills` renders key frames and `build/stills/contact.png`. Open the contact sheet and the frames
   that matter, and fix what you see. Stills work before the voice is done (provisional timing).
6. **Check.** `prs lint` must report 0 problems (layout, text provenance, caption band, novelty, QR).
7. **Render and publish.** `prs render` (seconds, frames are cached), then `prs publish`: encode, subtitles, the
   sync gate (audio vs captions), delivery to `~/Downloads/pr-videos/<slug>/`, and the gallery entry.
8. **Sign-off.** Follow [guides/review.md](guides/review.md) until the `pr-director` agent answers
   `VERDICT: SIGNED OFF`; republish after fixes.
9. **Deliver.** Give the mp4 path, its length, a one-line summary per beat, the verdict, and what you could not
   check (you can't hear the audio; the sync gate measures it).

Optional: if the user asks for options, add `export const concepts = { beat, options: { a, b, c } }` to
`scenes.js` and run `prs concepts`: it renders the beat three ways side by side.

## Rules

- **Accurate or absent.** Every statement in the narration and on screen must come from the PR: its body, commits,
  diff, tests or code at the head commit. Write the author's untested claims as "per the author". No guesses
  about intent, no marketing.
- **Text provenance.** Screen text goes through `label()` (your words), `fact()` (numbers and names from
  `pr.json`), `quote()` (exact PR text), `ident()` (code names in the diff), `path()` and `code()`. `prepare`
  verifies every one against the PR; numbers in a `label()` get flagged.
- **One look.** White, Microsoft palette, Aptos. Don't add colors, fonts, backgrounds or new layouts inside a
  video. The first frame (title) and the end card are fixed.
- **Different explanations.** Never open or copy another video's `scenes.js`; the gallery keeps only storyboards
  and contact sheets. If the catalog lacks a diagram the PR needs, add a treatment to `catalog/` (with demo,
  `when`, params, a catalog still via `prs catalog --stills`, lint clean) rather than hand-placing pixels.
- **Look at what you make.** Open the stills and the contact sheet before saying something works.

## Commands

| | |
| --- | --- |
| `prs new <url>` | fetch the PR, write brief.md and a storyboard skeleton |
| `prs check` | storyboard: length window, cues, placeholders, evidence anchors, pronunciation hints |
| `prs voice [--provider mai\|kokoro\|recording\|silent]` | narration + word timing (pause-snapped) |
| `prs direct [--use beat=treatment --reason ...]` | pick treatments and motion; scaffold scenes.js |
| `prs stills [--beat id] [--at 12.3,20]` | key frames + contact sheet |
| `prs lint [--every 0.5]` | layout, provenance, caption band, novelty, QR |
| `prs render` / `prs draft` | final frames / a half-size preview mp4 |
| `prs publish` | encode, subtitles, sync gate, deliver, gallery |
| `prs catalog` | every treatment with its params |
| `prs triage <PRs> \| --file f`, `prs summary`, `prs budget` | which PRs deserve a video (Slack runs); the closing message; minutes left in a cloud session |
| `prs history`, `prs report` | recent videos; where the time went |
| `prs smoke` | a short demo video end to end, with timings: is this machine ready? |
