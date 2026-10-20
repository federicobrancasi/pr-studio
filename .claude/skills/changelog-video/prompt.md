# The prompt for a run nobody watches

The daily job and its local stand-in ([scripts/changelog-video.sh](../../../scripts/changelog-video.sh)) start the
agent with this prompt, `<slug>` replaced by the project `prs digest new` made. The job adds only what its sandbox
needs (how it writes files, the tool it reports the video with). Everything else the agent needs is in the skill:
when a run goes wrong, fix the skill or the tools, not this prompt.

```text
Make today's VS Code changelog video. You are in pr-studio: `prs` is `node cli/prs.mjs`, run from here. The setup
already ran `prs digest new`: the project is videos/<slug> (the report, its PRs and the VS Code build are ready).

Follow .claude/skills/changelog-video/SKILL.md from step 2 to the end, after reading its example. Nobody is watching
this run and nobody answers questions: decide, and write each decision in one line in videos/<slug>/notes.md.
```
