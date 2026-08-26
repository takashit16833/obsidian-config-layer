const PLUGIN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseRequiredPluginIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('plugins.json must contain a JSON array of plugin IDs.');
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      throw new Error(`plugins.json entry ${index + 1} must be a string plugin ID.`);
    }

    const id = entry.trim();
    if (id.length === 0 || !PLUGIN_ID_PATTERN.test(id)) {
      throw new Error(`plugins.json entry ${index + 1} is not a valid plugin ID.`);
    }

    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}
