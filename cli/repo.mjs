// The repository's own commands: the #changelog videos, requests from Slack (cloud sessions), the README gallery.
// prs.mjs hands them over here; the plugin's build leaves them out.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, timed } from './lib/common.mjs';

export const REPO_COMMANDS = new Set(['changelog', 'digest', 'demo', 'prompt', 'triage', 'budget', 'prefetch', 'summary', 'gallery']);

export const REPO_HELP = `  prs changelog [--run id | file]    the videos for the top 5 of today's #changelog (report from vscode-engineering)
  prs digest new [--run id | --file report.md]   one video for the top 5 of a #changelog report (guides/digest.md)
  prs digest check | stills [--at t,..] | render | scenes [slug]   check, look at, render it; the drawn scenes
  prs demo <id> [--slug s]           record demos/<id>.mjs in VS Code (PRS_VSCODE: the build; signed in on macOS)
  prs prompt <PR>                    the prompt for a run nobody watches (a GitHub Actions job) to make that PR's video
  prs triage <PRs...> | --file f     which PRs get a video, which are faster to read (--cap n for a changelog)
  prs summary [triage.json]          the closing Slack message for a triage run
  prs budget                         minutes left in this cloud session (start a video only with 20 or more)
  prs prefetch [--text "..."]        cache the PRs named in a cloud session's request (its setup steps run this)
  prs gallery [--upload]             rebuild the README gallery (previews; --upload puts the videos in the release)
  prs history --collect              merge the history of the cloud sessions (copilot/* branches) into the gallery's
`;

export async function repoCommand(cmd, args) {
	switch (cmd) {
		case 'digest': {
			const { digestCommand } = await import('./lib/digest.mjs');
			process.exitCode = await digestCommand(args);
			return;
		}
		case 'demo': {
			const { demo } = await import('./lib/demo.mjs');
			const { digestSlug } = await import('./lib/digest.mjs');
			if (!args._[0]) {
				throw new Error('prs demo <id> [--slug changelog-<date>]: records videos/<slug>/demos/<id>.mjs');
			}
			await timed(null, 'demo', () => demo(digestSlug(args.slug), args._[0]));
			return;
		}
		case 'changelog': {
			const { changelog, printChangelog } = await import('./lib/changelog.mjs');
			const plan = await timed(null, 'changelog', () => changelog({ file: args._[0] ?? null, run: args.run ?? null }));
			printChangelog(plan);
			return;
		}
		case 'prompt': {
			const { prompt } = await import('./lib/prompt.mjs');
			console.log(prompt(args._[0], { repo: args.repo ?? 'microsoft/vscode' }));
			return;
		}
		case 'triage': {
			const { triage, printTriage } = await import('./lib/triage.mjs');
			const result = await timed(null, 'triage', () => triage(args._, { file: args.file ?? null, cap: args.cap ? Number(args.cap) : null, repo: args.repo ?? 'microsoft/vscode' }));
			printTriage(result);
			return;
		}
		case 'budget': {
			const { minutesLeft } = await import('./lib/triage.mjs');
			const left = minutesLeft();
			console.log(left === null ? 'no session clock: not a cloud session, and no /tmp/prs-start' : `${left} minutes left in this session`);
			return;
		}
		case 'prefetch': {
			const { prefetch } = await import('./lib/prefetch.mjs');
			await prefetch({ text: typeof args.text === 'string' ? args.text : null, repo: args.repo ?? 'microsoft/vscode' });
			return;
		}
		case 'summary': {
			const { summary } = await import('./lib/triage.mjs');
			let file = args._[0];
			if (!file) {
				const dir = path.join(ROOT, 'videos', '_triage');
				const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs) : [];
				file = all[0];
				if (!file) {
					throw new Error('No triage yet: run prs triage first');
				}
			}
			console.log(summary(file));
			return;
		}
		case 'gallery': {
			const { gallery } = await import('./lib/gallery.mjs');
			await gallery({ upload: !!args.upload });
			return;
		}
		default:
			throw new Error(`Not a repository command: ${cmd}`);
	}
}

/** prs history --collect: the cloud sessions' videos, from their copilot/* branches. */
export async function collectSessions() {
	const { collectHistory } = await import('./lib/history.mjs');
	const r = collectHistory();
	console.log(`history: ${r.total} videos, ${r.added} new from ${r.branches} session branch${r.branches === 1 ? '' : 'es'}`);
}
