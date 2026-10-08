#!/usr/bin/env node
// prs: make an explainer video for a pull request. Run `prs help` (or node cli/prs.mjs help).
import { guardOffline, resolveSlug, timed } from './lib/common.mjs';

const HELP = `prs: pull request explainer videos

  prs doctor                         check and install what the pipeline needs (voice model, ffmpeg, browser)
  prs changelog [--run id | file]    the videos for the top 5 of today's #changelog (report from vscode-engineering)
  prs prompt <PR>                    the prompt for a run nobody watches (a GitHub Actions job) to make that PR's video
  prs triage <PRs...> | --file f     which PRs get a video, which are faster to read (--cap n for a changelog)
  prs summary [triage.json]          the closing Slack message for a triage run
  prs budget                         minutes left in this cloud session (start a video only with 20 or more)
  prs prefetch [--text "..."]        cache the PRs named in a cloud session's request (its setup steps run this)
  prs new <PR URL | owner/repo#n>    fetch the PR and the files it changes into videos/<slug>/ (brief.md, storyboard skeleton)
  prs check [slug]                   check the storyboard: length window, cues, placeholders, evidence anchors
  prs voice [slug] [--provider p]    narration + word timing (providers: auto, mai, kokoro, recording, silent)
  prs direct [slug] [--seed n]       pick the diagram treatments and motion for each beat; scaffold scenes.js
  prs prepare [slug]                 verify every on-screen text and code reference; build the video page
  prs stills [slug] [--beat id] [--at t1,t2]   key frames + contact sheet in build/stills/
  prs lint [slug] [--every 0.5]      layout, text provenance, caption band, novelty, QR
  prs draft [slug]                   quick half-size preview mp4
  prs render [slug]                  final frames (cached; unchanged frames are reused)
  prs publish [slug]                 encode, captions file, sync gate, deliver, add to the gallery
  prs concepts [slug]                render the options in scenes.js \`concepts\` side by side
  prs catalog [--stills]             list the treatments (and render their catalog stills)
  prs history [--collect]            what recent videos used; --collect merges the cloud sessions' (copilot/* branches)
  prs gallery [--upload]             rebuild the README gallery (previews; --upload puts the videos in the release)
  prs report [slug]                  where the time went
  prs smoke [--provider p]           make a short demo video end to end with timings (checks this machine)

PRS_OFFLINE=1: no network (an agent sandbox): run prs new before, then everything works from what it downloaded.
`;

function parseArgs(argv) {
	const args = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const [k, v] = a.slice(2).split('=');
			if (v !== undefined) {
				args[k] = v;
			} else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
				args[k] = argv[++i];
			} else {
				args[k] = true;
			}
		} else {
			args._.push(a);
		}
	}
	return args;
}

async function main() {
	guardOffline();
	const [cmd, ...rest] = process.argv.slice(2);
	const args = parseArgs(rest);
	const slugArg = () => resolveSlug(args._[0]);
	switch (cmd) {
		case undefined:
		case 'help':
		case '--help':
			console.log(HELP);
			return;
		case 'doctor': {
			const { doctor } = await import('./lib/doctor.mjs');
			process.exitCode = (await doctor(args)) ? 0 : 1;
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
			const fs = await import('node:fs');
			const path = await import('node:path');
			const { ROOT } = await import('./lib/common.mjs');
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
		case 'new': {
			const { newVideo } = await import('./lib/fetch.mjs');
			const { ref, data, code, reused } = await timed(null, 'new', () => newVideo(args._[0], args._[1], { force: !!args.force }));
			console.log(`videos/${ref.slug}: ${data.facts.title}${reused ? ' (downloaded before this run: offline)' : ''}`);
			console.log(`  +${data.facts.additions} \u2212${data.facts.deletions} in ${data.facts.changedFiles} files \u00b7 head ${data.facts.headSha9} \u00b7 ${data.tier.name}: ${data.tier.seconds[0]}-${data.tier.seconds[1]} s, ${data.tier.beats} beats`);
			if (code) {
				console.log(`  code: ${code.saved} of the ${data.facts.files.length} changed files saved at the head commit${code.failed.length ? ` (not downloaded: ${code.failed.map(f => f.path).join(', ')})` : ''}`);
			}
			console.log(`  read videos/${ref.slug}/brief.md, then write videos/${ref.slug}/storyboard.json`);
			return;
		}
		case 'check': {
			const slug = slugArg();
			const { checkStory } = await import('./lib/check.mjs');
			const ok = await timed(slug, 'check', () => checkStory(slug));
			process.exitCode = ok ? 0 : 1;
			return;
		}
		case 'voice': {
			const slug = slugArg();
			const { voice } = await import('./lib/voice.mjs');
			await timed(slug, 'voice', () => voice(slug, { provider: args.provider, force: !!args.force, recording: args.recording }));
			return;
		}
		case 'direct': {
			const slug = slugArg();
			const { direct } = await import('./lib/direct.mjs');
			await timed(slug, 'direct', () => direct(slug, { seed: args.seed, motion: args.motion, use: args.use, reason: args.reason, force: !!args.force }));
			return;
		}
		case 'prepare': {
			const slug = slugArg();
			const { prepare } = await import('./lib/prepare.mjs');
			await timed(slug, 'prepare', () => prepare(slug));
			return;
		}
		case 'stills': {
			const slug = slugArg();
			const { prepare } = await import('./lib/prepare.mjs');
			const { stills } = await import('./lib/stills.mjs');
			await timed(slug, 'prepare', () => prepare(slug));
			const at = args.at ? String(args.at).split(',').map(Number) : null;
			const out = await timed(slug, 'stills', () => stills(slug, { at, beat: args.beat }));
			console.log(`${out.images.length} stills in ${out.dir}\ncontact sheet: ${out.sheet}`);
			return;
		}
		case 'lint': {
			const slug = slugArg();
			const { prepare } = await import('./lib/prepare.mjs');
			const { lint } = await import('./lib/lint.mjs');
			await timed(slug, 'prepare', () => prepare(slug, { quiet: true }));
			const ok = await timed(slug, 'lint', () => lint(slug, { every: args.every ? Number(args.every) : 0 }));
			process.exitCode = ok ? 0 : 1;
			return;
		}
		case 'draft':
		case 'render': {
			const slug = slugArg();
			const { prepare } = await import('./lib/prepare.mjs');
			const { render } = await import('./lib/render.mjs');
			await timed(slug, 'prepare', () => prepare(slug, { quiet: true }));
			await timed(slug, cmd, () => render(slug, { draft: cmd === 'draft', workers: args.workers ? Number(args.workers) : 0 }));
			return;
		}
		case 'publish': {
			const slug = slugArg();
			const { publish } = await import('./lib/publish.mjs');
			await timed(slug, 'publish', () => publish(slug, { skipSync: !!args['skip-sync'] }));
			return;
		}
		case 'concepts': {
			const slug = slugArg();
			const { concepts } = await import('./lib/concepts.mjs');
			await timed(slug, 'concepts', () => concepts(slug));
			return;
		}
		case 'catalog': {
			const { catalog } = await import('./lib/catalog.mjs');
			await catalog({ stills: !!args.stills, only: args.only });
			return;
		}
		case 'gallery': {
			const { gallery } = await import('./lib/gallery.mjs');
			await gallery({ upload: !!args.upload });
			return;
		}
		case 'history': {
			const { collectHistory, printHistory } = await import('./lib/history.mjs');
			if (args.collect) {
				const r = collectHistory();
				console.log(`history: ${r.total} videos, ${r.added} new from ${r.branches} session branch${r.branches === 1 ? '' : 'es'}`);
			}
			printHistory(Number(args.last ?? 8));
			return;
		}
		case 'smoke': {
			const { smoke } = await import('./lib/smoke.mjs');
			const { ok } = await smoke({ provider: args.provider });
			process.exitCode = ok ? 0 : 1;
			return;
		}
		case 'report': {
			const slug = slugArg();
			const { report } = await import('./lib/report.mjs');
			report(slug);
			return;
		}
		default:
			console.error(`Unknown command "${cmd}".\n${HELP}`);
			process.exitCode = 2;
	}
}

main().catch(error => {
	console.error(`prs: ${error.message}`);
	if (process.env.PRS_DEBUG) {
		console.error(error.stack);
	}
	process.exitCode = 1;
});
