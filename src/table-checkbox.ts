import { Extension } from "@codemirror/state";
import { EditorView, Decoration, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

class TableCheckboxWidget extends WidgetType {
	constructor(private readonly checked: boolean) {
		super();
	}

	// Important: for efficient widget comparison
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

	// Prevent CM6 from handling cursor positioning
	override ignoreEvent(event: Event): boolean {
		return event.type === "click" || event.type === "mousedown";
	}
}

const checkboxDecorator = new MatchDecorator({
	// Match [ ] or [x] inside tables
	regexp: /\[([ x])\]/g,
	decoration: (match) => {
		const isChecked = match[1] === "x";
		return Decoration.replace({
			widget: new TableCheckboxWidget(isChecked),
		});
	},
});

function shouldDecorateTable(view: EditorView): boolean {
	// Check if we're in Live Preview mode
	const livePreview = view.state.field(editorLivePreviewField, false);
	if (!livePreview) return false;

	// Simple check: does the viewport contain table markers (|)
	const { from, to } = view.viewport;
	const text = view.state.doc.sliceString(from, to);
	return text.includes("|");
}

const tableCheckboxExtension: Extension = [
	ViewPlugin.fromClass(
		class {
			decorations;

			constructor(view: EditorView) {
				this.decorations = checkboxDecorator.createDeco(view);
			}

			update(update: ViewUpdate) {
				// Only update if we're in a table context
				if (shouldDecorateTable(update.view)) {
					this.decorations = checkboxDecorator.updateDeco(update, this.decorations);
				} else {
					this.decorations = Decoration.none;
				}
			}
		},
		{
			decorations: (v) => v.decorations,
			eventHandlers: {
				mousedown: (e, view) => {
					const target = e.target as HTMLInputElement;
					if (target.classList.contains("decorator-widgets-checkbox")) {
						e.preventDefault();
						e.stopPropagation();
						return true;
					}
				},
				click: (e, view) => {
					const target = e.target as HTMLInputElement;
					if (target.classList.contains("decorator-widgets-checkbox")) {
						e.preventDefault();
						e.stopPropagation();

						const pos = view.posAtDOM(target);
						if (pos === null) return false;

						const newChar = target.checked ? "x" : " ";

						view.dispatch({
							changes: {
								from: pos + 1,
								to: pos + 2,
								insert: newChar,
							},
							userEvent: "input",
							scrollIntoView: false,
						});

						return true;
					}
				},
			},
		}
	),
];

export function registerTableCheckboxExtension(): Extension {
	return tableCheckboxExtension;
}
