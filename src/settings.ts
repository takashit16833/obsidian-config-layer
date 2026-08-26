import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type ConfigLayerPlugin from './main';

export class ConfigLayerSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ConfigLayerPlugin) {
    super(app, plugin);
  }

  display(): void {
    void this.render();
  }

  private async render(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Config Layer' });

    new Setting(containerEl)
      .setName('CSS folder')
      .setDesc('Absolute path, ~/ path, or path relative to the vault root.')
      .addText((text) => text
        .setPlaceholder('~/dotfiles/obsidian/css')
        .setValue(this.plugin.settings.cssFolder)
        .onChange(async (value) => {
          this.plugin.settings.cssFolder = value;
          await this.plugin.saveSettings();
          await this.plugin.cssManager.refresh();
          this.plugin.cssManager.restartWatcher();
        }));

    new Setting(containerEl)
      .setName('Refresh CSS files')
      .setDesc('Scan the configured folder again.')
      .addButton((button) => button
        .setButtonText('Refresh')
        .onClick(async () => {
          await this.plugin.cssManager.refresh();
          await this.render();
        }));

    containerEl.createEl('h3', { text: 'Shared CSS' });
    await this.renderCssFiles(containerEl);

    new Setting(containerEl)
      .setName('Hotkeys folder')
      .setDesc('Folder containing the shared hotkeys.json. Shared command IDs override vault-specific values.')
      .addText((text) => text
        .setPlaceholder('~/dotfiles/obsidian')
        .setValue(this.plugin.settings.hotkeysFolder)
        .onChange(async (value) => {
          this.plugin.settings.hotkeysFolder = value;
          await this.plugin.saveSettings();
          this.plugin.hotkeysManager.restartWatcher();
        }));

    new Setting(containerEl)
      .setName('Apply shared hotkeys')
      .setDesc('Merge shared hotkeys into this vault immediately.')
      .addButton((button) => button
        .setButtonText('Apply')
        .setCta()
        .onClick(async () => {
          try {
            const result = await this.plugin.hotkeysManager.apply();
            if (!result.applied) {
              new Notice('Config Layer: configure a hotkeys folder first.');
            } else if (result.changed) {
              new Notice('Config Layer applied shared hotkeys.');
            } else {
              new Notice('Config Layer: shared hotkeys are already up to date.');
            }
          } catch (error) {
            console.error('Config Layer: failed to apply shared hotkeys', error);
            new Notice('Config Layer could not apply shared hotkeys. Check the developer console.');
          }
        }));

    new Setting(containerEl)
      .setName('Watch external files')
      .setDesc('Reload enabled CSS and re-apply hotkeys automatically when source files change.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.watchExternalFiles)
        .onChange(async (value) => {
          this.plugin.settings.watchExternalFiles = value;
          await this.plugin.saveSettings();
          this.plugin.restartWatchers();
        }));
  }

  private async renderCssFiles(containerEl: HTMLElement): Promise<void> {
    const files = await this.plugin.cssManager.listCssFiles();
    if (files.length === 0) {
      containerEl.createEl('p', { text: 'No CSS files found in the configured folder.' });
      return;
    }

    for (const file of files) {
      new Setting(containerEl)
        .setName(file)
        .addToggle((toggle) => toggle
          .setValue(this.plugin.settings.enabledCssFiles[file] === true)
          .onChange(async (value) => {
            this.plugin.settings.enabledCssFiles[file] = value;
            await this.plugin.saveSettings();
            await this.plugin.cssManager.refresh();
          }));
    }
  }
}
