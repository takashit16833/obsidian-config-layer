import type { HotkeyBackup, HotkeyBackups, JsonObject } from './types';

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasOwn(object: JsonObject | HotkeyBackups, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function captureBackup(vaultHotkeys: JsonObject, commandId: string): HotkeyBackup {
  return hasOwn(vaultHotkeys, commandId)
    ? { kind: 'value', value: vaultHotkeys[commandId] }
    : { kind: 'missing' };
}

// Platform-specific entries take precedence; unrelated shared commands remain intact.
export function mergeSharedHotkeySources(common: JsonObject, platform: JsonObject): JsonObject {
  return { ...common, ...platform };
}

export interface MergeHotkeysResult {
  merged: JsonObject;
  backups: HotkeyBackups;
  changed: boolean;
}

export function mergeManagedHotkeys(
  vaultHotkeys: JsonObject,
  previousManaged: JsonObject,
  previousBackups: HotkeyBackups,
  sharedHotkeys: JsonObject,
): MergeHotkeysResult {
  const merged: JsonObject = { ...vaultHotkeys };
  const backups: HotkeyBackups = { ...previousBackups };

  for (const [commandId, previousValue] of Object.entries(previousManaged)) {
    if (hasOwn(sharedHotkeys, commandId)) {
      continue;
    }

    const currentStillManaged = hasOwn(merged, commandId)
      && valuesEqual(merged[commandId], previousValue);

    if (currentStillManaged) {
      const backup = backups[commandId];
      if (backup?.kind === 'value') {
        merged[commandId] = backup.value;
      } else if (backup?.kind === 'missing') {
        delete merged[commandId];
      }
      // `unknown` means this installation predates backup tracking. Preserve the
      // current value rather than guessing whether a vault-specific value existed.
    }

    delete backups[commandId];
  }

  for (const [commandId, sharedValue] of Object.entries(sharedHotkeys)) {
    if (!hasOwn(previousManaged, commandId)) {
      backups[commandId] = captureBackup(merged, commandId);
    } else if (!hasOwn(backups, commandId)) {
      // Safe migration for values managed by versions that did not retain the
      // pre-shared vault value.
      backups[commandId] = { kind: 'unknown' };
    }

    merged[commandId] = sharedValue;
  }

  return {
    merged,
    backups,
    changed: !valuesEqual(vaultHotkeys, merged),
  };
}
