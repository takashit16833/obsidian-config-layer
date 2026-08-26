import { Notice, Plugin } from 'obsidian';
import { CssManager } from './css-manager';
import { HotkeysManager } from './hotkeys-manager';
import { PluginsManager } from './plugins-manager';
import { ConfigLayerSettingTab } from './settings';
import { DEFAULT_SETTINGS, type ConfigLayerSettings, type HotkeyBackups, type JsonObject } from './types';

export default class ConfigLayerPlugin extends Plugin {
  settings: ConfigLayerSettings = { ...DEFAULT_SETTINGS };
  cssManager!: CssManager;
  hotkeysManager!: HotkeysManager;
  pluginsManager!: PluginsManager;

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
    this.pluginsManager = new PluginsManager(this.app, () => this.settings);

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
      await this.hotkeysManager.apply();
    } catch (error) {
      console.error('Config Layer: failed to apply shared hotkeys on startup', error);
    }

    this.app.workspace.onLayoutReady(() => {
      void this.pluginsManager.apply().catch((error) => {
        console.error('Config Layer: failed to apply required plugins on startup', error);
        new Notice('Config Layer could not apply required plugins. Check the developer console.');
      });
    });
  }

  onunload(): void {
    this.cssManager.stop();
    this.hotkeysManager.stop();
    this.pluginsManager.stop();
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<ConfigLayerSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      pluginsFolder: loaded?.pluginsFolder ?? loaded?.hotkeysFolder ?? DEFAULT_SETTINGS.pluginsFolder,
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
    this.pluginsManager.restartWatcher();
  }

  private async refreshAll(showNotice: boolean): Promise<void> {
    try {
      await this.cssManager.refresh();
      await this.hotkeysManager.apply();
      await this.pluginsManager.apply(false);
      if (showNotice) {
        new Notice('Config Layer refreshed.');
      }
    } catch (error) {
      console.error('Config Layer: refresh failed', error);
      if (showNotice) {
        new Notice('Config Layer refresh failed. Check the developer console.');
      }
    }
  }
}
