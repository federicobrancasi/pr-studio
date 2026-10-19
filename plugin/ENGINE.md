# The pr-studio engine

The code behind the skills of the pr-studio plugin: `prs` (the CLI), the video engine, theme, diagram catalog and
voice, and `deck/` (slide decks). The plugin's `scripts/setup.mjs` unpacked it here from `engine.pack`; its source is
https://github.com/federicobrancasi/pr-studio (MIT), without the parts only that repository needs (Slack, the
changelog, the gallery).

The skills run `node <this folder>/cli/prs.mjs <command>`. Videos and decks are made in `videos/` and `decks/` here
and delivered to `~/Downloads/`. Settings and the history of published videos stay in `~/.cache/pr-studio/`
(`PRS_HOME` moves them), so they outlast updates: a new version of the plugin unpacks into a new folder, and the
oldest copies are removed.
