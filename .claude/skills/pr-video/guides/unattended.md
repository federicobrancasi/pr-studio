# Runs nobody watches

A job started automatically (the daily changelog videos in GitHub Actions) or from Slack: nobody reads your
messages until it's over, and nobody answers questions. These rules come before the rest of the skill.

1. **Make the video the normal way**, as in [SKILL.md](../SKILL.md): `prs new`, the story, `prs voice` in the
   background, `prs direct`, `prs stills`, `prs lint`, `prs render`, `prs publish`.
2. **Don't ask questions.** When something is unclear, decide, and write the decision in one line in
   `videos/<slug>/notes.md`.
3. **Time:** aim for 25 minutes and stop at 40. When the same step fails twice the same way (a check, the sync gate,
   a render), stop: write what failed and the error in `notes.md`.
4. **Look once:** image views may be limited, so open the contact sheet of the final version, not drafts. `prs lint`
   checks every frame's layout.
5. **One review round:** after `prs publish`, run the `pr-director` agent once, fix its must-fixes, publish again,
   and stop there.
6. **Leave pr-studio as it is:** no commits, pushes or pull requests, and no changes to the CLI, catalog, theme or
   guides. If something in them is broken, say so in `notes.md`.
7. **No internet?** When `PRS_OFFLINE` is set (a sandbox without network), the PR and every file it changes were
   downloaded before you started, and `prs new` continues from them. Everything comes from `videos/<slug>/`
   (brief.md, pr.diff, pr.json): `gh`, `curl` and web lookups don't work, and only the changed files can be shown.

`prs publish` puts the result in the delivery folder the job sets (`PRS_DELIVER`): the mp4, its captions and
`<slug>.json` (PR, headline, length). That is all the job needs. End with a two-line summary: the video's path
and length, and the reviewer's verdict.
