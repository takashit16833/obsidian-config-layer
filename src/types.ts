export type JsonObject = Record<string, unknown>;

export interface ConfigLayerSettings {
  cssFolder: string;
  hotkeysFolder: string;
  enabledCssFiles: Record<string, boolean>;
  managedHotkeys: JsonObject;
  watchExternalFiles: boolean;
}

export const DEFAULT_SETTINGS: ConfigLayerSettings = {
  cssFolder: '',
  hotkeysFolder: '',
  enabledCssFiles: {},
  managedHotkeys: {},
  watchExternalFiles: true,
};
