// prs report: where the time went (from build/timings.jsonl).
import fs from 'node:fs';
import path from 'node:path';
import { buildDir } from './common.mjs';

export function report(slug) {
	const file = path.join(buildDir(slug), 'timings.jsonl');
	if (!fs.existsSync(file)) {
		console.log('No timings yet.');
		return;
	}
	const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
	const byPhase = new Map();
	for (const r of rows) {
		const e = byPhase.get(r.phase) ?? { runs: 0, total: 0, last: 0 };
		e.runs++;
		e.total += r.seconds;
		e.last = r.seconds;
		byPhase.set(r.phase, e);
	}
	const first = new Date(rows[0].at), last = new Date(rows.at(-1).at);
	console.log(`${slug}: ${rows.length} tool runs over ${((last - first) / 60000).toFixed(1)} min of work`);
	console.log('phase        runs   last (s)   total (s)');
	let sum = 0;
	for (const [phase, e] of byPhase) {
		sum += e.total;
		console.log(`${phase.padEnd(12)} ${String(e.runs).padStart(4)} ${e.last.toFixed(1).padStart(10)} ${e.total.toFixed(1).padStart(11)}`);
	}
	console.log(`tools total: ${sum.toFixed(1)} s; the rest of the elapsed time was writing and reviewing.`);
}
