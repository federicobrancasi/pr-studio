// prs demo on Linux: the environment VS Code gets inside a sandbox (gh-aw's agent firewall).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareLinuxEnv } from '../cli/lib/demo.mjs';

test('VS Code gets its own runtime dir, a font config, and the system libraries instead of the sandbox copies', () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prs-demo-test-'));
	try {
		const env = { LD_LIBRARY_PATH: '/run/awf-lib/browser-libs/usr/lib/x86_64-linux-gnu:/opt/hostedtoolcache/Python/3.12.15/x64/lib', LD_PRELOAD: '/run/awf-lib/one-shot-token.so' };
		prepareLinuxEnv(env, tmp);
		const sandboxOnly = { LD_LIBRARY_PATH: '/run/awf-lib/browser-libs/usr/lib' };
		prepareLinuxEnv(sandboxOnly, fs.mkdtempSync(path.join(tmp, 'b-')));
		assert.deepStrictEqual({
			runtime: path.relative(tmp, env.XDG_RUNTIME_DIR),
			mode: (fs.statSync(env.XDG_RUNTIME_DIR).mode & 0o777).toString(8),
			libraries: env.LD_LIBRARY_PATH,
			preload: env.LD_PRELOAD,
			fonts: fs.existsSync(env.FONTCONFIG_FILE),
			sandboxOnly: 'LD_LIBRARY_PATH' in sandboxOnly,
		}, {
			runtime: 'run',
			mode: '700',
			libraries: '/opt/hostedtoolcache/Python/3.12.15/x64/lib',
			preload: '/run/awf-lib/one-shot-token.so',
			fonts: true,
			sandboxOnly: false,
		});
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});
