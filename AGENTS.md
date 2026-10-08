# pr-studio: agent guide

This repo makes short explainer videos of pull requests: give it a PR URL, get a 40-100 second video that explains
what changes, why, how it works, the risk and the status, in one consistent white Microsoft look, with diagrams
chosen per PR. Use the **`pr-video` skill** in `.claude/skills/pr-video/SKILL.md` for any such request. Reviews
go to the **`pr-director`** agent in `.claude/agents/pr-director.md`.

## Setup

```sh
npm install
node cli/prs.mjs doctor
```

In a Copilot cloud session the setup steps in `.github/workflows/copilot-setup-steps.yml` already did this.

## Requests from Slack

Sessions started from Slack with @GitHub (a changelog link, "video 339632", PR links) follow
[`.claude/skills/pr-video/guides/slack.md`](.claude/skills/pr-video/guides/slack.md). In short: triage first
(`prs triage`), post the plan, then make the videos one at a time and post each mp4 in the thread as soon as it is
published; never ask questions (nobody answers), commit only `gallery/history.jsonl`, and stay within the
59-minute session.

## Map

| Path | Holds |
| --- | --- |
| `cli/` | the `prs` CLI (`node cli/prs.mjs help`) |
| `engine/` | runtime: timing, stage and motion modes, text provenance, the authoring API (`scene.js`, `text.js`) |
| `theme/` | the fixed look: tokens, primitives, title frame parts, end card, captions, code panels |
| `catalog/` | diagram treatments, by explanation need; each with params, a demo and a catalog still |
| `voice/` | narration: MAI-Voice-2, Kokoro (offline), your recording; Whisper alignment; pause snapping; sync gate |
| `.claude/skills/pr-video/` | the skill, its guides, and `catalog.md` with a still per treatment |
| `.claude/agents/pr-director.md` | the reviewer that signs videos off |
| `videos/<slug>/` | work in progress (git-ignored): brief, storyboard, direction, scenes, build |
| `gallery/` | published videos: storyboard, direction, contact sheet, a small preview for the README, and `history.jsonl` (cloud sessions' videos are collected into it daily); the full mp4s are in the GitHub release `gallery`, not in git |
| `.github/workflows/` | `copilot-setup-steps.yml`: the cloud agent's environment (run it by hand for a smoke video with timings); `tidy-sessions.yml`: collects the sessions' history and closes their drafts |

## Invariants

- On-screen text is traceable: `label`, `fact`, `quote`, `ident`, `path`, `code` (`engine/text.js`). `prepare`
  verifies every reference against the PR at its head commit; `lint` fails on text without provenance.
- Every frame is a pure function of time, so frames can be cached, skipped and rendered in any order.
- The look is fixed (white, Microsoft palette, Aptos): no per-video colors, fonts or backgrounds.
- Variety comes from `prs direct`, which picks treatments and motion away from recent videos. Never copy another
  video's `scenes.js`; the gallery keeps storyboards and contact sheets only.
- The skill and agent live in `.claude/` once: Copilot (VS Code and CLI) and Claude Code both read it there.
- Look at the stills you render before saying something works, and say what you could not check.
