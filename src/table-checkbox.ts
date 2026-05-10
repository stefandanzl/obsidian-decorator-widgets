import { Extension, Prec } from "@codemirror/state";
import { EditorView, Decoration, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

class TableCheckboxWidget extends WidgetType {
	constructor(private readonly checked: boolean) {
		super();
	}

	eq(other: TableCheckboxWidget): boolean {
		return other.checked === this.checked;
	}

	toDOM() {
		const wrapper = document.createElement("span");
		wrapper.className = "task-list-item decorator-widgets-wrapper";

		const label = document.createElement("label");
		label.className = "task-list-label decorator-widgets-label";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "task-list-item-checkbox decorator-widgets-checkbox";
		checkbox.checked = this.checked;
		checkbox.tabIndex = -1;

		label.appendChild(checkbox);
		wrapper.appendChild(label);

		return wrapper;
	}

	override ignoreEvent(event: Event): boolean {
		console.log("[Decorator Widgets] Widget ignoreEvent:", event.type);
		return true; // Ignore ALL events from the widget
	}
}

const checkboxDecorator = new MatchDecorator({
	regexp: /\[([ x])\]/g,
	decoration: (match, view, pos) => {
		// Check if this position is inside a table by examining the line
		const line = view.state.doc.lineAt(pos);
		const lineText = view.state.doc.sliceString(line.from, line.to);

		// Only render if the line contains a pipe character (table indicator)
		if (!lineText.includes("|")) {
			return null;
		}

		// Skip if in code block (simple check)
		if (/^[ \t]{4,}/.test(lineText)) {
			return null;
		}

		const isChecked = match[1] === "x";
		console.log("[Decorator Widgets] Creating decoration for checkbox in table");
		return Decoration.replace({
			widget: new TableCheckboxWidget(isChecked),
		});
	},
});

const tableCheckboxExtension: Extension = [
	ViewPlugin.fromClass(
		class {
			decorations = Decoration.none;

			constructor(view: EditorView) {
				console.log("[Decorator Widgets] CM6 ViewPlugin constructor");
				const livePreview = view.state.field(editorLivePreviewField, false);
				console.log("[Decorator Widgets] Live Preview enabled:", livePreview);
				if (livePreview) {
					this.decorations = checkboxDecorator.createDeco(view);
					console.log("[Decorator Widgets] Decorations created, count:", this.decorations.size);
				} else {
					console.log("[Decorator Widgets] Not in Live Preview, skipping CM6 decorations");
				}
			}

			update(update: ViewUpdate) {
				const livePreview = update.view.state.field(editorLivePreviewField, false);
				if (!livePreview) {
					this.decorations = Decoration.none;
					return;
				}

				if (update.docChanged || update.viewportChanged) {
					this.decorations = checkboxDecorator.updateDeco(update, this.decorations);
					console.log("[Decorator Widgets] Decorations updated, count:", this.decorations.size);
				}
			}
		},
		{
			decorations: (v) => v.decorations,
			eventHandlers: {
				mousedown: (e, view) => {
					console.log("[Decorator Widgets] mousedown event on:", (e.target as HTMLElement).className);
					const target = e.target as HTMLInputElement;
					if (target.classList.contains("decorator-widgets-checkbox")) {
						console.log("[Decorator Widgets] Preventing mousedown on checkbox");
						e.preventDefault();
						e.stopPropagation();
						return true;
					}
				},
				click: (e, view) => {
					console.log("[Decorator Widgets] click event on:", (e.target as HTMLElement).className);
					const target = e.target as HTMLInputElement;
					if (target.classList.contains("decorator-widgets-checkbox")) {
						console.log("[Decorator Widgets] Clicking checkbox, checked before:", target.checked);
						e.preventDefault();
						e.stopPropagation();

						// Toggle the checkbox state manually since we prevented default
						target.checked = !target.checked;
						console.log("[Decorator Widgets] Checkbox checked after:", target.checked);

						const pos = view.posAtDOM(target);
						console.log("[Decorator Widgets] CM6 pos:", pos);
						if (pos === null) {
							console.log("[Decorator Widgets] Could not get position");
							return false;
						}

						const newChar = target.checked ? "x" : " ";
						console.log("[Decorator Widgets] CM6 dispatching:", newChar);

						view.dispatch({
							changes: {
								from: pos + 1,
								to: pos + 2,
								insert: newChar,
							},
							userEvent: "input.select", // Use select event to avoid cursor movement
							scrollIntoView: false,
						});

						return true;
					}
				},
			},
		},
	),
];

export function registerTableCheckboxExtension(): Extension {
	return Prec.highest(tableCheckboxExtension);
}
