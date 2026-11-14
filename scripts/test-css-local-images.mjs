import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const dir = await mkdtemp(path.join(tmpdir(), 'config-layer-css-test-'));
const outfile = path.join(dir, 'css-local-images.mjs');

try {
  await esbuild.build({
    entryPoints: ['src/css-local-images.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });

  const { inlineLocalImageUrls } = await import(pathToFileURL(outfile).href);
  const pictures = path.join(dir, 'Pictures');
  await mkdir(pictures);
  await writeFile(path.join(pictures, 'my wallpaper.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(path.join(pictures, 'wallpaper.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  await writeFile(path.join(pictures, 'not-an-image.txt'), 'secret');

  const css = [
    '/* url("~/Pictures/ignored.png") */',
    ':root { --wallpaper: url("~/Pictures/my wallpaper.png"); }',
    ".a { background: url('~/Pictures/wallpaper.jpg'); }",
    '.b { background: url(~/Pictures/wallpaper.jpg); }',
    '.c { background: url("https://example.com/image.png"); }',
    '.d { background: url("data:image/png;base64,AA=="); }',
    '.e { background: url("./other.jpg"); }',
  ].join('\n');

  const result = await inlineLocalImageUrls(css, dir);
  assert.match(result, /url\("data:image\/png;base64,iVBORw=="\)/);
  assert.equal(result.match(/url\("data:image\/jpeg;base64,\/9j\/"\)/g)?.length, 2);
  assert.match(result, /\/\* url\("~\/Pictures\/ignored.png"\) \*\//);
  assert.match(result, /url\("https:\/\/example.com\/image.png"\)/);
  assert.match(result, /url\("data:image\/png;base64,AA=="\)/);
  assert.match(result, /url\("\.\/other.jpg"\)/);

  const warnings = [];
  const oldWarn = console.warn;
  try {
    console.warn = (...args) => warnings.push(args);
    assert.equal(await inlineLocalImageUrls('a { background: url("~/Pictures/missing.png") }', dir), 'a { background: none }');
    assert.equal(await inlineLocalImageUrls('a { background: url("~/Pictures/not-an-image.txt") }', dir), 'a { background: none }');
  } finally {
    console.warn = oldWarn;
  }
  assert.equal(warnings.length, 2);

  console.log('css-local-images tests passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
