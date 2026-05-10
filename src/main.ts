import { Plugin } from "obsidian";
import { MySettings } from "./types";
import { DEFAULT_SETTINGS, MyPluginSettingTab } from "./settings";
import { registerTableCheckboxExtension } from "./table-checkbox";
import { registerPreviewProcessor } from "./preview-processor";

export default class MyPlugin extends Plugin {
	settings: MySettings;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Add settings tab
		this.addSettingTab(new MyPluginSettingTab(this.app, this));

		// Register CM6 extensions for Source/Live Preview mode
		this.registerEditorExtension([registerTableCheckboxExtension()]);

		// Register preview processor for Reading/Preview mode
		registerPreviewProcessor(this);
	}
}
