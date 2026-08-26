import { Notice, Plugin } from 'obsidian';
import { CssManager } from './css-manager';
import { HotkeysManager } from './hotkeys-manager';
import { ConfigLayerSettingTab } from './settings';
import { DEFAULT_SETTINGS, type ConfigLayerSettings, type HotkeyBackups, type JsonObject } from './types';

export default class ConfigLayerPlugin extends Plugin {
  settings: ConfigLayerSettings = { ...DEFAULT_SETTINGS };
  cssManager!: CssManager;
  hotkeysManager!: HotkeysManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.cssManager = new CssManager(this.app, () => this.settings);
    this.hotkeysManager = new HotkeysManager(
      this.app,
      () => this.settings,
      async (managed: JsonObject, backups: HotkeyBackups) => {
        this.settings.managedHotkeys = managed;
        this.settings.hotkeyBackups = backups;
        await this.saveSettings();
      },
    );

    this.addSettingTab(new ConfigLayerSettingTab(this.app, this));

    this.addCommand({
      id: 'refresh-shared-config',
      name: 'Refresh shared configuration',
      callback: () => {
        void this.refreshAll(true);
      },
    });

    await this.cssManager.refresh();
    this.restartWatchers();

    try {
      const result = await this.hotkeysManager.apply();
      if (result.changed) {
        new Notice('Config Layer applied shared hotkeys. Reload Obsidian to activate them.');
      }
    } catch (error) {
      console.error('Config Layer: failed to apply shared hotkeys on startup', error);
    }
  }

  onunload(): void {
    this.cssManager.stop();
    this.hotkeysManager.stop();
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<ConfigLayerSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      enabledCssFiles: { ...DEFAULT_SETTINGS.enabledCssFiles, ...(loaded?.enabledCssFiles ?? {}) },
      managedHotkeys: { ...DEFAULT_SETTINGS.managedHotkeys, ...(loaded?.managedHotkeys ?? {}) },
      hotkeyBackups: { ...DEFAULT_SETTINGS.hotkeyBackups, ...(loaded?.hotkeyBackups ?? {}) },
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  restartWatchers(): void {
    this.cssManager.restartWatcher();
    this.hotkeysManager.restartWatcher();
  }

  private async refreshAll(showNotice: boolean): Promise<void> {
    try {
      await this.cssManager.refresh();
      const result = await this.hotkeysManager.apply();
      if (showNotice) {
        new Notice(result.changed
          ? 'Config Layer refreshed. Reload Obsidian to activate updated hotkeys.'
          : 'Config Layer refreshed.');
      }
    } catch (error) {
      console.error('Config Layer: refresh failed', error);
      if (showNotice) {
        new Notice('Config Layer refresh failed. Check the developer console.');
      }
    }
  }
}
