import { Extension, Prec } from "@codemirror/state";
import { EditorView, Decoration, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

// Try to import syntaxTree - it might be available through the bundle
// @ts-ignore - Obsidian bundles this but doesn't export it
import { syntaxTree } from "@codemirror/language";

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
		return event.type === "click" || event.type === "mousedown";
	}
}

const checkboxDecorator = new MatchDecorator({
	regexp: /\[([ x])\]/g,
	decoration: (match, view, pos) => {
		// Use syntax tree to check if we're inside a table
		let isInsideTable = false;

		try {
			const tree = syntaxTree(view.state);
			const node = tree.resolveInner(pos, 1);

			// Walk up the tree to check if we're in a table
			let curr: typeof node | null = node;
			while (curr) {
				// Check for table-related node names
				if (
					curr.name.includes("table") ||
					curr.name.includes("Table") ||
					curr.name === "TableHeader" ||
					curr.name === "TableRow" ||
					curr.name === "TableCell"
				) {
					isInsideTable = true;
					break;
				}
				// Skip if in code block
				if (
					curr.name === "FencedCode" ||
					curr.name === "CodeBlock" ||
					curr.name === "InlineCode"
				) {
					return null;
				}
				curr = curr.parent;
			}
		} catch (e) {
			// Fallback to line-based detection if syntaxTree fails
			const line = view.state.doc.lineAt(pos);
			const lineText = view.state.doc.sliceString(line.from, line.to);
			if (!lineText.includes("|")) return null;
		}

		// Only render if inside a table
		if (!isInsideTable) return null;

		const isChecked = match[1] === "x";
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
				const livePreview = view.state.field(editorLivePreviewField, false);
				if (livePreview) {
					this.decorations = checkboxDecorator.createDeco(view);
				}
			}

			update(update: ViewUpdate) {
				const livePreview = update.view.state.field(editorLivePreviewField, false);
				if (!livePreview) {
					this.decorations = Decoration.none;
					return;
				}

				this.decorations = checkboxDecorator.updateDeco(update, this.decorations);
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
	return Prec.highest(tableCheckboxExtension);
}
