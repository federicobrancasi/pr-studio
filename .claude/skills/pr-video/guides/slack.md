# Requests from Slack

A session started from Slack with **@GitHub** runs in the cloud: Linux with 2 cores, the Kokoro voice, no
Office fonts, and a hard limit of **59 minutes** for the whole session. Nobody is watching: the person who asked
reads the Slack thread later, often on a phone. These rules come before the rest of the skill.

## What people ask

| Request | Looks like | Do |
| --- | --- | --- |
| A changelog | a link to a #changelog message, "videos for today's changelog" | triage it, then up to 3 videos |
| Pull requests | PR links, `owner/repo#n`, or numbers (= microsoft/vscode): "video 339632" | triage them, then a video each |
| Anyway | "video anyway 339518", "force" | the video, even if triage says it's faster to read |

Anything else: answer in one or two sentences and stop.

## The run

1. **Start.** `date +%s > /tmp/prs-start` first (a fallback clock; `node cli/prs.mjs budget` reads the session's
   own one and prints the minutes left of the 59). Then `mkdir -p videos/_triage` and `node cli/prs.mjs doctor`, which
   should end with `ready` (the setup steps installed everything). If it warns that the GitHub API is blocked by
   the firewall, go on: the setup steps cached the PRs named in the request, and triage lists the ones it couldn't
   read. If triage could read none, post its plan (it says why) and stop.
2. **Triage** (seconds):
   - Changelog: write the linked message into `videos/_triage/changelog.txt` exactly as it reads, then a line
     `---`, then every reply in its thread, in order. Keep the PR links. Then
     `node cli/prs.mjs triage --file videos/_triage/changelog.txt`. If you can only read the main message,
     triage that and say so in one line.
   - Pull requests: `node cli/prs.mjs triage <refs...>`.
3. **Post the plan**: the triage's Slack text (printed after `--- Slack ---`, also `slack` in the triage json),
   as is, as your first reply in the thread.
4. **Videos, one at a time, in the triage's order.** Make each one by [unattended.md](unattended.md) (the rules
   for runs nobody watches), with these additions here:
   - Start a video only if `node cli/prs.mjs budget` says **20 minutes** or more are left (one takes 15-20 here).
     Otherwise stop: the summary says which ones didn't fit.
   - Write to the tier's word range (about 2 words a second) so the first voice run fits the window: Kokoro
     takes about twice the narration's length here, and Whisper another half.
   - Use the catalog as it is (no new treatments). `prs stills` at most twice.
   - **Post the video as soon as it's signed off**, before starting the next: attach
     `~/Downloads/pr-videos/<slug>/<slug>.mp4` as a file, with one line:
     `<PR link|#number> *headline* (m:ss)`.
   - When a video stops on a failure, post one line (which PR, which step, the error in a few words) and go on
     with the next.
5. **Close.** Commit `gallery/history.jsonl` (only that file) and push it to your branch: a daily workflow
   copies it to main, so the next sessions pick different diagrams. Then post the output of
   `node cli/prs.mjs summary` as the last message.

## Don't

- Ask questions or wait for answers: decide, and say what you decided in the thread in one line.
- Commit anything but `gallery/history.jsonl` (and the videos, when Slack refuses them; see below), or mark the
  session's pull request ready for review: it is a throwaway draft that a daily workflow closes. pr-studio itself
  (CLI, catalog, theme) doesn't change in these sessions; if something is broken, say so in the summary.
- Post logs, stills, file lists or progress notes. The thread gets: the plan, each video, a line per failure, the
  summary.

## When the mp4 can't be attached

If your Slack tool can't upload the file (or Slack refuses it), commit the videos to your working branch under
`deliver/<YYYY-MM-DD>/<slug>.mp4`, push, and post the GitHub links instead
(`https://github.com/<owner>/<repo>/blob/<branch>/deliver/...`). Say once that the branch is throwaway.
