#!/usr/bin/env bash
# The daily changelog video on this machine, as the daily job makes it: prs digest new (the report, its PRs, and
# VS Code built from main when Insiders doesn't have the picks), then an agent nobody watches (the GitHub Copilot
# CLI) with the changelog-video skill's prompt and the job's tools.
#
#   scripts/changelog-video.sh [--run <report run id>] [--model claude-opus-5.5] [--credits 1500]
#
# Needs: gh (signed in to an account that can read the changelog report), the copilot CLI. The agent's log and its
# session go to videos/<slug>/build/agent/.
set -euo pipefail
cd "$(dirname "$0")/.."

run=""
model="claude-opus-5.5"
credits="1500"
while [ $# -gt 0 ]; do
	case "$1" in
		--run) run="$2"; shift 2 ;;
		--model) model="$2"; shift 2 ;;
		--credits) credits="$2"; shift 2 ;;
		*) echo "usage: scripts/changelog-video.sh [--run <report run id>] [--model <model>] [--credits <n>]" >&2; exit 2 ;;
	esac
done

export CHANGELOG_TOKEN="${CHANGELOG_TOKEN:-$(gh auth token)}"
setup=$(node cli/prs.mjs digest new ${run:+--run "$run"})
echo "$setup"
slug=$(printf '%s\n' "$setup" | sed -n 's#^videos/\(changelog-[0-9-]*\):.*#\1#p' | head -n 1)
if [ -z "$slug" ]; then
	echo "prs digest new didn't make a project" >&2
	exit 1
fi

# The prompt: the text block of the skill's prompt.md, for this project.
prompt=$(awk '/^```text$/ { inside = 1; next } /^```$/ { inside = 0 } inside' .claude/skills/changelog-video/prompt.md | sed "s#<slug>#$slug#g")
out="videos/$slug/build/agent"
mkdir -p "$out"

# The job's tools: these commands in the shell, and file edits. Nothing else (no git, no network tools).
tools=()
for c in cd node python3 cat ls grep head tail sed awk cut tr wc sort uniq find echo printf jq mkdir cp mv rm sleep ps pgrep date test; do
	tools+=(--allow-tool "shell($c)")
done

start=$(date +%s)
copilot -p "$prompt" --model "$model" --no-ask-user --disable-builtin-mcps --add-dir "$PWD" \
	"${tools[@]}" --allow-tool write --max-ai-credits "$credits" \
	--log-dir "$out/logs" --share "$out/session.md" 2>&1 | tee "$out/agent.log"
echo "agent: $(( ($(date +%s) - start) / 60 )) min, model $model; its session: $out/session.md"
