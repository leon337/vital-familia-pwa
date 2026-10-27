import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

// These Bash denial checks execute only in GitHub Actions, never against a database.
describe.skipIf(process.env.GITHUB_ACTIONS !== 'true')('legacy staging entrypoints fail closed', () => {
  for (const name of ['staging-migrate.sh', 'staging-recovery.sh']) {
    const script = fileURLToPath(new URL(`../scripts/${name}`, import.meta.url));

    it(`${name} contains only an unconditional diagnostic and exit`, () => {
      const commands = readFileSync(script, 'utf8').split('\n')
        .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      // Exact allowlist: catches SQL clients, includes, delegation, and env/argument bypasses.
      expect(commands).toEqual([
        "printf '%s\\n' 'Deprecated: use the guarded GitHub Actions staging workflow maintained by BRUNO. Legacy migration/recovery entrypoints are disabled.' >&2",
        'exit 1',
      ]);
    });

    it.each([undefined, '', 'postgresql://synthetic.invalid/denied']) (
      `${name} refuses DATABASE_URL=%j even with legacy approval flags`, databaseUrl => {
        const result = spawnSync('/bin/bash', ['--noprofile', '--norc', script, script], {
          // Do not inherit credentials or BASH_ENV from the runner. No external commands available.
          env: {
            PATH: '/nonexistent',
            ...(databaseUrl === undefined ? {} : {DATABASE_URL: databaseUrl}),
            GOVERNED_TARGET: 'br-polished-recipe-b6yh4cw2',
            BACKEND_GATE_APPROVED: 'true',
            RECOVERY_DISPOSABLE_TARGET: 'true',
            PGDATABASE: 'synthetic',
            PGHOST: 'synthetic.invalid',
          },
          encoding: 'utf8',
          timeout: 2000,
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('Deprecated: use the guarded GitHub Actions staging workflow maintained by BRUNO. Legacy migration/recovery entrypoints are disabled.\n');
      },
    );
  }
});
