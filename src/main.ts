import { Plugin } from "obsidian";
import { MySettings } from "./types";
import { DEFAULT_SETTINGS, MyPluginSettingTab } from "./settings";
import { tableCheckboxExtension, toggleTableCheckbox } from "./table-checkbox";
import { registerPreviewProcessor } from "./preview-processor";

export default class MyPlugin extends Plugin {
	settings: MySettings;

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Add settings tab
		this.addSettingTab(new MyPluginSettingTab(this.app, this));

		// Register CM6 extensions for Source/Live Preview mode
		this.registerEditorExtension([tableCheckboxExtension]);

		// Register keyboard shortcut to toggle table checkboxes
		this.addCommand({
			id: "toggle-table-checkbox",
			name: "Toggle table checkbox",
			callback: () => {
				const activeEditor = this.app.workspace.activeEditor;
				if (activeEditor?.editor) {
					// Get the CodeMirror editor view
					const cmEditor = (activeEditor.editor as any).cm;
					if (cmEditor) {
						const success = toggleTableCheckbox(cmEditor);
					if (!success) {
						// Optional: show status message if not on a table checkbox
						// this.setStatusBarMessage("Not a table checkbox", 2000);
					}
					}
				}
			},
			hotkeys: [
				{
					modifiers: ["Mod", "Shift"],
					key: "c",
				},
			],
		});

		// Register preview processor for Reading/Preview mode
		registerPreviewProcessor(this);
	}
}
