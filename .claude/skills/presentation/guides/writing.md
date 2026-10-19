# Writing the slides

The bar: every slide is one idea, drawn as a picture more than written as text, and every fact on it can be traced to
where it came from. Look at the samples (`prs deck samples`, then `deck/samples/out/contact.png`) before writing.

## Before you write

- **The room.** Who will see it, what they already know, and what they should know or do afterwards. Put it in a comment
  at the top of `deck.mjs`; it decides every cut.
- **The length.** About 1.3 minutes a slide: a 10-minute talk is 7–9 slides, a 5-minute update 4–5. A deck that is read,
  not presented, can be shorter still.
- **The facts first.** Gather them, each with where it comes from (a URL, a PR, a file and line, a doc). A fact you can't
  trace doesn't go on a slide.

## Rules for every slide

1. **One idea.** The title says the point, not the topic, in ≤ 8 plain words (≤ 48 characters): "Edits wait in a
   queue" works, "Sync" doesn't. The eyebrow names the topic in 2–4 words.
2. **Concrete before abstract.** Show the thing first (a real screen, a real number, the flow), then name the idea.
3. **At most 25 words besides the title** (45 on a story, 60 on a `term` card). The build counts them and warns above
   30. Everything else goes into `notes`: the speaker says it, the audience doesn't read it.
4. **Every number has a source:** `sources: ['Short label | https://…']`. The build flags numbers without one. A shaky
   number is left out. `nosrc: true` only when the numbers aren't statistics (dates, version numbers, steps).
5. **Every slide has `notes`:** 2–5 plain sentences: what to say, what to ask, any caveat. `say` is the one line to
   remember (≤ 70 characters).
6. **A different picture on every slide.**
   - Never the same layout twice in a row, and a layout at most twice per section. The build checks both.
   - At least half the slides are diagrams, pictures or big single ideas. The text-box layouts are `checklist`,
     `steps`, `pillars`, `board`, `grid`, `matrix`, `split` and `term`.
   - One or two full-colour slides for rhythm: `bg: 'dark'` or `'blue'` on a statement, quote, hero or icons slide.
7. **Colour has meaning:** green good, red risk, orange attention, yellow medium, purple the AI, blue neutral. Pair it with
   an icon or a word.
8. **Honest.** No invented quotes, numbers or events. Quote people word for word (shorten with "…"). Label prototypes and
   previews as such. A made-up example has to look like one.
9. **A real event gets its story first.** If a lesson rests on something that happened (an incident, a study, a PR), a
   `story` slide comes before it: when, who, what they did, what went wrong, the outcome.
10. **New words get explained** the first time, if a later slide needs them: `defines: ['term']` on the slide that
    explains it, or a `term` card.
11. **Links** where someone would want to open something (a PR, a doc, a video): `link: { url, label, logo | icon }` draws
    a QR code with a label and is a real link in the PDF. About one slide in four, at most one per slide.
12. **No gray boxes, no soft shadows.** Cards are soft colour tints; emphasis is a sharp ring. PDF viewers draw blurred
    shadows as gray rectangles; the build flags them.

## Voice

Plain, calm and concrete. Say what happens and what to do. No hype ("game-changer", "seamless", "revolutionary",
"unlock") and no emoji. Technical where the audience is technical, but never jargon for its own sake.

## A shape that works

For a talk about one change (a pull request, a feature, a project), 7–9 slides:

1. `title`
2. the problem, made concrete: a `story`, a `hero` number, a `quote`, or the screen as it was
3. the idea in one sentence: `statement`
4. how it works: one or two diagrams (`pipeline`, `flow`, `sequence`, `lanes`, `journey`, `layers`, `code`)
5. what it changes, with real numbers if there are any: `counters`, `bars`, `split`
6. what is risky or still open: `checklist`, `quad`, `spectrum`
7. what to do now, or where to start reading: `board`, `steps`, `howto`, with a `link`
8. `end`

For a deck about a pull request, `prs new <PR URL>` fetches its brief, diff and the changed files into
`videos/<slug>/` (the video workflow's first step): read `brief.md` and search `pr.diff` for the facts.
