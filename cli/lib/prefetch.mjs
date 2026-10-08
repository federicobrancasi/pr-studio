// prs prefetch: run by the Copilot setup steps, outside the agent's firewall. Finds the pull requests named in the
// session's request (the session's draft PR quotes it) and fetches them, so that prs triage and prs new can read
// them from the HTTP cache when the firewall blocks api.github.com during the session.
import { api } from './github.mjs';
import { fetchPr } from './fetch.mjs';

const MAX = 15;

/**
 * PR references in a request, in order: links, owner/repo#n, #n, and bare 5-7 digit numbers ("video 339632"), the
 * last two in `repo`. Unlike a changelog line, a request can name several PRs in one sentence.
 */
export function requestRefs(text, repo = 'microsoft/vscode') {
	const re = /github\.com\/(?<linkRepo>[\w.-]+\/[\w.-]+)\/pull\/(?<linkNumber>\d+)|(?<![\w/])(?<refRepo>[\w.-]+\/[\w.-]+)#(?<refNumber>\d+)|(?<![\w/#&])#(?<hashNumber>\d{3,7})\b|(?<![\w/#.:-])(?<bareNumber>\d{5,7})(?![\w/.:-])/g;
	const refs = [];
	for (const { groups: g } of String(text).matchAll(re)) {
		const full = g.linkRepo ?? g.refRepo ?? repo;
		const number = Number(g.linkNumber ?? g.refNumber ?? g.hashNumber ?? g.bareNumber);
		if (!refs.some(r => r.full === full && r.number === number)) {
			refs.push({ full, number });
		}
	}
	return refs;
}

/** The request of this cloud session: the body of its draft pull request (GITHUB_TOKEN of the setup steps). */
async function sessionRequest() {
	const repo = process.env.GITHUB_REPOSITORY;
	const number = process.env.COPILOT_AGENT_PR_NUMBER;
	if (repo && number) {
		return (await api(`repos/${repo}/pulls/${number}`)).body ?? '';
	}
	const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
	if (!repo || !branch?.startsWith('copilot/')) {
		return null;
	}
	const list = await api(`repos/${repo}/pulls?head=${repo.split('/')[0]}:${encodeURIComponent(branch)}&state=open`);
	return list[0]?.body ?? null;
}

export async function prefetch({ text = null, repo = 'microsoft/vscode' } = {}) {
	const request = text ?? await sessionRequest();
	if (!request) {
		console.log('prefetch: no session request found (not a cloud session?)');
		return { refs: [], fetched: 0 };
	}
	const refs = requestRefs(request, repo).filter(r => !/\/pr-studio$/.test(r.full)).slice(0, MAX);
	let fetched = 0;
	for (const r of refs) {
		const [owner, name] = r.full.split('/');
		try {
			await fetchPr({ full: r.full, owner, repo: name, number: r.number });
			fetched++;
		} catch (error) {
			console.log(`prefetch: ${r.full}#${r.number}: ${String(error.message).split('\n')[0].slice(0, 120)}`);
		}
	}
	console.log(`prefetch: ${fetched} of ${refs.length} pull requests cached${refs.length ? ` (${refs.map(r => `#${r.number}`).join(', ')})` : ''}`);
	return { refs, fetched };
}
