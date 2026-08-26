export type JsonObject = Record<string, unknown>;

export type HotkeyBackup =
  | { kind: 'missing' }
  | { kind: 'value'; value: unknown }
  | { kind: 'unknown' };

export type HotkeyBackups = Record<string, HotkeyBackup>;

export interface ConfigLayerSettings {
  cssFolder: string;
  hotkeysFolder: string;
  pluginsFolder: string;
  enabledCssFiles: Record<string, boolean>;
  managedHotkeys: JsonObject;
  hotkeyBackups: HotkeyBackups;
  watchExternalFiles: boolean;
}

export const DEFAULT_SETTINGS: ConfigLayerSettings = {
  cssFolder: '',
  hotkeysFolder: '',
  pluginsFolder: '',
  enabledCssFiles: {},
  managedHotkeys: {},
  hotkeyBackups: {},
  watchExternalFiles: true,
};
