import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'config-layer-test-'));
const outfile = path.join(dir, 'merge-hotkeys.mjs');

try {
  await esbuild.build({
    entryPoints: ['src/merge-hotkeys.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });

  const { mergeManagedHotkeys } = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);

  const vault = { local: 'X', shared: 'Q' };
  const sharedY = { shared: 'Y' };

  const first = mergeManagedHotkeys(vault, {}, {}, sharedY);
  assert.deepEqual(first.merged, { local: 'X', shared: 'Y' });
  assert.deepEqual(first.backups, { shared: { kind: 'value', value: 'Q' } });

  const sharedZ = { shared: 'Z' };
  const updated = mergeManagedHotkeys(first.merged, sharedY, first.backups, sharedZ);
  assert.deepEqual(updated.merged, { local: 'X', shared: 'Z' });
  assert.deepEqual(updated.backups, { shared: { kind: 'value', value: 'Q' } });

  const restored = mergeManagedHotkeys(updated.merged, sharedZ, updated.backups, {});
  assert.deepEqual(restored.merged, vault);
  assert.deepEqual(restored.backups, {});

  const added = mergeManagedHotkeys({ local: 'X' }, {}, {}, sharedY);
  assert.deepEqual(added.backups, { shared: { kind: 'missing' } });
  const removed = mergeManagedHotkeys(added.merged, sharedY, added.backups, {});
  assert.deepEqual(removed.merged, { local: 'X' });

  const userChangedVault = { ...first.merged, shared: 'USER' };
  const preserved = mergeManagedHotkeys(userChangedVault, sharedY, first.backups, {});
  assert.deepEqual(preserved.merged, { local: 'X', shared: 'USER' });

  const migration = mergeManagedHotkeys({ shared: 'Y' }, { shared: 'Y' }, {}, {});
  assert.deepEqual(migration.merged, { shared: 'Y' });

  console.log('merge-hotkeys tests passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
