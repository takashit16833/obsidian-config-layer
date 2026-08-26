import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'config-layer-test-'));
const outfile = path.join(dir, 'manage-plugins.mjs');

try {
  await esbuild.build({
    entryPoints: ['src/manage-plugins.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });

  const { parseRequiredPluginIds, planRequiredPlugins } = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);

  assert.deepEqual(parseRequiredPluginIds(['alpha', 'beta', 'alpha']), ['alpha', 'beta']);
  assert.throws(() => parseRequiredPluginIds({ alpha: true }), /JSON array/);
  assert.throws(() => parseRequiredPluginIds(['../escape']), /Invalid plugin ID/);
  assert.throws(() => parseRequiredPluginIds(['valid', 42]), /must be strings/);

  const plan = planRequiredPlugins(
    ['shared-enabled', 'shared-disabled', 'shared-missing'],
    new Set(['shared-enabled', 'shared-disabled', 'vault-only']),
    new Set(['shared-enabled', 'vault-only']),
  );
  assert.deepEqual(plan, {
    install: ['shared-missing'],
    enable: ['shared-disabled'],
  });

  const removedFromShared = planRequiredPlugins(
    ['shared-enabled'],
    new Set(['shared-enabled', 'formerly-shared', 'vault-only']),
    new Set(['shared-enabled', 'formerly-shared', 'vault-only']),
  );
  assert.deepEqual(removedFromShared, { install: [], enable: [] });

  console.log('manage-plugins tests passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
