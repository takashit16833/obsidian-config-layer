import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

// Match CSS url() references beginning with ~/ while leaving ordinary URLs alone.
// Comments are matched first, so examples inside comments are never read.
const CSS_LOCAL_IMAGE_URL = /\/\*[\s\S]*?\*\/|url\(\s*(?:"(~\/[^"\r\n]*)"|'(~\/[^'\r\n]*)'|(~\/[^\s'"()]+))\s*\)/gi;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

export async function inlineLocalImageUrls(css: string, homeDirectory = homedir()): Promise<string> {
  let output = '';
  let offset = 0;

  for (const match of css.matchAll(CSS_LOCAL_IMAGE_URL)) {
    const localUrl = match[1] ?? match[2] ?? match[3];
    if (localUrl === undefined) {
      continue; // CSS comment.
    }

    const imagePath = path.join(homeDirectory, localUrl.slice(2));
    const mimeType = IMAGE_MIME_TYPES[path.extname(imagePath).toLowerCase()];
    let replacement = 'none';

    try {
      if (mimeType === undefined) {
        throw new Error('unsupported image extension');
      }
      const file = await stat(imagePath);
      if (!file.isFile() || file.size > MAX_IMAGE_BYTES) {
        throw new Error('not a regular image file or image exceeds 32 MiB');
      }
      const image = await readFile(imagePath);
      replacement = `url("data:${mimeType};base64,${image.toString('base64')}")`;
    } catch (error) {
      console.warn(`Config Layer: cannot load CSS image ${imagePath}`, error);
    }

    output += css.slice(offset, match.index) + replacement;
    offset = match.index + match[0].length;
  }

  return output + css.slice(offset);
}
