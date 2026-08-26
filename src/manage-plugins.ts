export interface RequiredPluginPlan {
  install: string[];
  enable: string[];
}

function isSafePluginId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !value.includes('..');
}

export function parseRequiredPluginIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('plugins.json must contain a JSON array of plugin IDs.');
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error('plugins.json entries must be strings.');
    }

    const id = item.trim();
    if (id.length === 0 || !isSafePluginId(id)) {
      throw new Error(`Invalid plugin ID in plugins.json: ${JSON.stringify(item)}`);
    }

    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

export function planRequiredPlugins(
  requiredPluginIds: readonly string[],
  installedPluginIds: ReadonlySet<string>,
  enabledPluginIds: ReadonlySet<string>,
): RequiredPluginPlan {
  const install: string[] = [];
  const enable: string[] = [];

  for (const pluginId of requiredPluginIds) {
    if (!installedPluginIds.has(pluginId)) {
      install.push(pluginId);
    } else if (!enabledPluginIds.has(pluginId)) {
      enable.push(pluginId);
    }
  }

  return { install, enable };
}
