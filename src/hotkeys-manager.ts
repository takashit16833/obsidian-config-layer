import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { getVaultHotkeysPath, resolveConfiguredPath } from './paths';
import { mergeManagedHotkeys } from './merge-hotkeys';
import type { ConfigLayerSettings, HotkeyBackups, JsonObject } from './types';

export interface ApplyHotkeysResult {
  applied: boolean;
  changed: boolean;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObject(filePath: string, missingAsEmpty: boolean): Promise<JsonObject> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(text);
    if (!isJsonObject(parsed)) {
      throw new Error(`${filePath} must contain a JSON object.`);
    }
    return parsed;
  } catch (error) {
    if (missingAsEmpty && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export class HotkeysManager {
  private watcher: FSWatcher | null = null;
  private applyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => ConfigLayerSettings,
    private readonly updateManagedState: (managed: JsonObject, backups: HotkeyBackups) => Promise<void>,
  ) {}

  async apply(): Promise<ApplyHotkeysResult> {
    const settings = this.getSettings();
    const folder = resolveConfiguredPath(this.app, settings.hotkeysFolder);
    if (folder === null) {
      return { applied: false, changed: false };
    }

    const sharedPath = path.join(folder, 'hotkeys.json');
    const vaultPath = getVaultHotkeysPath(this.app);
    const sharedHotkeys = await readJsonObject(sharedPath, false);
    const vaultHotkeys = await readJsonObject(vaultPath, true);
    const result = mergeManagedHotkeys(
      vaultHotkeys,
      settings.managedHotkeys,
      settings.hotkeyBackups,
      sharedHotkeys,
    );

    if (result.changed) {
      await fs.writeFile(vaultPath, `${JSON.stringify(result.merged, null, 2)}\n`, 'utf8');
    }

    await this.updateManagedState(sharedHotkeys, result.backups);
    return { applied: true, changed: result.changed };
  }

  restartWatcher(): void {
    this.stopWatcher();

    if (!this.getSettings().watchExternalFiles) {
      return;
    }

    const folder = resolveConfiguredPath(this.app, this.getSettings().hotkeysFolder);
    if (folder === null) {
      return;
    }

    try {
      this.watcher = watch(folder, (_eventType, filename) => {
        if (filename === null || filename.toString() === 'hotkeys.json') {
          this.scheduleApply();
        }
      });
      this.watcher.on('error', (error) => {
        console.error('Config Layer: hotkeys watcher error', error);
        this.stopWatcher();
      });
    } catch (error) {
      console.error('Config Layer: failed to watch hotkeys folder', error);
    }
  }

  stop(): void {
    this.stopWatcher();
    if (this.applyTimer !== null) {
      clearTimeout(this.applyTimer);
      this.applyTimer = null;
    }
  }

  private scheduleApply(): void {
    if (this.applyTimer !== null) {
      clearTimeout(this.applyTimer);
    }
    this.applyTimer = setTimeout(() => {
      this.applyTimer = null;
      void this.apply().catch((error) => {
        console.error('Config Layer: failed to apply shared hotkeys', error);
        new Notice('Config Layer could not apply shared hotkeys. Check the developer console.');
      });
    }, 150);
  }

  private stopWatcher(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
