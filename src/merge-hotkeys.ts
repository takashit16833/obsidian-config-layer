import type { JsonObject } from './types';

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export interface MergeHotkeysResult {
  merged: JsonObject;
  changed: boolean;
}

export function mergeManagedHotkeys(
  vaultHotkeys: JsonObject,
  previousManaged: JsonObject,
  sharedHotkeys: JsonObject,
): MergeHotkeysResult {
  const merged: JsonObject = { ...vaultHotkeys };

  for (const [commandId, previousValue] of Object.entries(previousManaged)) {
    if (commandId in sharedHotkeys) {
      continue;
    }

    if (commandId in merged && valuesEqual(merged[commandId], previousValue)) {
      delete merged[commandId];
    }
  }

  for (const [commandId, sharedValue] of Object.entries(sharedHotkeys)) {
    merged[commandId] = sharedValue;
  }

  return {
    merged,
    changed: !valuesEqual(vaultHotkeys, merged),
  };
}
