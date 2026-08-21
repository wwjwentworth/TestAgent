import { defaultSettings, type ExtensionSettings } from "../domain/recording";
const key = "extension-settings";
export async function loadSettings(): Promise<ExtensionSettings> {
    const stored = await chrome.storage.local.get(key);
    return {
        ...defaultSettings,
        ...(stored[key] as Partial<ExtensionSettings> | undefined),
    };
}
export async function saveSettings(settings: ExtensionSettings): Promise<void> {
    await chrome.storage.local.set({ [key]: settings });
}
