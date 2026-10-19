---
name: presentation
description: Use when the user wants a slide deck or a presentation as a PDF (a talk, a team update, a review for a manager, an explainer of a pull request, a feature or a project) in the white Microsoft studio look. Covers the brief, gathering facts with sources, the outline, picking layouts, writing deck.mjs, building and checking, and delivery.
---

# Presentation

A 16:9 PDF deck in the studio look (white, Microsoft palette, Aptos): one idea per slide, drawn as a picture more than
written as text, a source under every number, speaker notes for every slide, and click-by-click builds where they help.
The slides are plain data in `deck.mjs`; `prs deck build` draws them and checks them. Commands: `node cli/prs.mjs
<command>` from the repo root, or `node <path to pr-studio>/cli/prs.mjs <command>` from anywhere (below: `prs`).

## Start

- Once per machine: `prs doctor` (the build needs its browser).
- Look at [samples.png](samples.png): one slide for every layout (`prs deck samples` builds them full size into
  `deck/samples/out/slides/`). The data of each is in `deck/samples/deck.mjs`, under the same `id` as its layout.
- Read [guides/writing.md](guides/writing.md) and [guides/layouts.md](guides/layouts.md). When no layout fits an idea,
  [guides/designs.md](guides/designs.md).

## Workflow

1. **Brief.** What it's about, who will see it, how long, and what they should know or do afterwards. Infer what you can
   from the request and the workspace; ask only for what you can't. Without an answer: engineers, 7–9 slides, presented.
2. **Facts.** Gather them from the sources (files, docs, pull requests, issues, URLs) and note where each one comes from:
   that goes into `sources`. For a pull request, `prs new <PR URL>` writes its brief, diff and changed files into
   `videos/<slug>/`; read `brief.md` and search `pr.diff`.
3. **Outline.** One line per slide: the point (its title), the picture (its layout) and the evidence. If someone is
   watching and the deck is long, show them the outline before writing.
4. **Write.** `prs deck new <slug> --title "…"` starts `decks/<slug>/deck.mjs`. Fill it from the outline, copying the
   fields of each layout's sample. Pictures go in `decks/<slug>/assets/`, designs of the deck's own in
   `decks/<slug>/designs/`.
5. **Build.** `prs deck build <slug>`. It must end with `Checks: clean`: fix the slide, not the check (cut words, pick
   another layout, add the source).
6. **Look.** Open `decks/<slug>/out/contact.png`, then the page PNGs (`out/slides/NNN.png`) of the slides that matter.
   Fix what is crowded, clipped, empty-looking or hard to read, and build again.
7. **Deliver.** The build copied the PDF, the contact sheet, the speaker notes and `slides/` (a picture per slide) to
   `~/Downloads/pr-decks/<slug>/`. Give the PDF's path, the number of slides and minutes, one line per slide, and what
   you couldn't check.

## Rules

- **Accurate or absent.** Every statement and number comes from a source you read; write untested claims as "per the
  author". No invented quotes, numbers or events, and no marketing words.
- **One look.** The theme is fixed: no new colours, fonts or backgrounds. Variety comes from picking a different picture
  for every slide, not from styling.
- **Look at what you make.** Open the contact sheet and the pages before saying the deck is done.
- **Fix the cause.** When a check fires, change the slide; `maxWords` and `nosrc` are for real exceptions only.

## Commands

| | |
| --- | --- |
| `prs deck new <slug> [--title "…"]` | start `decks/<slug>/deck.mjs` with a title and an end slide |
| `prs deck build [slug] [--no-deliver]` | PDF, a PNG per page, contact sheet, notes and checks in `decks/<slug>/out/`; deliver |
| `prs deck samples` | build the layout samples: one slide per layout |
| `prs deck list` | the decks in `decks/` |
| `prs new <PR URL>` | a pull request's brief, diff and changed files, for the facts |
