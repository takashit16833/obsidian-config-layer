import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'config-layer-plugin-list-test-'));
const outfile = path.join(dir, 'plugin-list.mjs');

try {
  await esbuild.build({
    entryPoints: ['src/plugin-list.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });

  const { parseRequiredPluginIds } = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);

  assert.deepEqual(parseRequiredPluginIds(['alpha', 'beta-plugin']), ['alpha', 'beta-plugin']);
  assert.deepEqual(parseRequiredPluginIds([' alpha ', 'alpha', 'beta.plugin']), ['alpha', 'beta.plugin']);
  assert.deepEqual(parseRequiredPluginIds([]), []);

  assert.throws(() => parseRequiredPluginIds({}), /JSON array/);
  assert.throws(() => parseRequiredPluginIds(['alpha', 42]), /must be a string/);
  assert.throws(() => parseRequiredPluginIds(['']), /valid plugin ID/);
  assert.throws(() => parseRequiredPluginIds(['../escape']), /valid plugin ID/);
  assert.throws(() => parseRequiredPluginIds(['bad/id']), /valid plugin ID/);

  console.log('plugin-list tests passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
