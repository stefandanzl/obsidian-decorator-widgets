import { App, PluginSettingTab, Setting } from "obsidian";
import type MyPlugin from "./main";
import type { MySettings } from "./types";

export const DEFAULT_SETTINGS: MySettings = {
	enabled: true,
};

export class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Decorator Widgets")
			.setHeading();

		new Setting(containerEl)
			.setName("Enable table checkboxes")
			.setDesc("Transform [ ] and [x] in Markdown tables into interactive checkboxes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveData(this.plugin.settings);
					})
			);

		containerEl.createEl("p", {
			text: "More settings coming soon! This plugin adds interactive checkbox widgets to Markdown tables.",
			cls: "setting-item-description",
		});
	}
}
