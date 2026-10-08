# Sign-off

Nothing is delivered as final until the `pr-director` agent signs it off. It sees what the author no longer sees:
a number that doesn't match the diff, a highlight that lands two words late, a box nobody can read on a laptop.

1. Make sure `prs lint` is clean and `prs publish` passed the sync gate.
2. Run `prs stills` on the final version (the director reads `build/stills/contact.png` and single frames).
3. Run the `pr-director` agent (`.claude/agents/pr-director.md`) as a subagent on the strongest model available.
   Give it:
   - the PR URL and the slug
   - the paths: `videos/<slug>/brief.md`, `pr.diff`, `storyboard.json`, `scenes.js`, `build/stills/`, the mp4
   - from the second round on: the last verdict and what you changed
4. Fix every must-fix, render, publish, ask again. Stop at `VERDICT: SIGNED OFF` and quote it when you deliver.

If you can't start subagents, review against the checklist in `pr-director.md` yourself, as strictly as a second
person would, and tell the user no independent sign-off happened.
