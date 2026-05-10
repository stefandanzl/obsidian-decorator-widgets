import { Extension } from "@codemirror/state";
import { EditorView, Decoration, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
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

function isInsideTable(view: EditorView, pos: number): boolean {
	const line = view.state.doc.lineAt(pos);
	const lineText = view.state.doc.sliceString(line.from, line.to);
	return lineText.includes("|");
}

function isInsideCodeBlock(view: EditorView, pos: number): boolean {
	const line = view.state.doc.lineAt(pos);
	const lineText = view.state.doc.sliceString(line.from, line.to);

	// Skip indented code blocks
	if (/^[ \t]{4,}/.test(lineText)) {
		return true;
	}

	// Check for fenced code blocks by looking backwards
	const doc = view.state.doc;
	let currentLine = line;
	let linesChecked = 0;
	let insideCodeBlock = false;

	while (currentLine && linesChecked < 100) {
		const text = doc.sliceString(currentLine.from, currentLine.to).trim();

		if (text.startsWith("```")) {
			insideCodeBlock = currentLine.from < line.from;
			break;
		}

		if (currentLine.from === 0) break;

		currentLine = doc.lineAt(currentLine.from - 1);
		linesChecked++;
	}

	return insideCodeBlock;
}

function buildDecorations(view: EditorView) {
	const builder = new RangeSetBuilder<Decoration>();
	const { from, to } = view.viewport;
	const doc = view.state.doc;
	const checkboxRegex = /\[([ x])\]/g;

	for (let pos = from; pos <= to; ) {
		const line = doc.lineAt(pos);
		const lineContent = doc.sliceString(line.from, line.to);

		// Skip if in code block
		if (isInsideCodeBlock(view, line.from)) {
			pos = line.to + 1;
			continue;
		}

		// Find checkboxes in this line
		checkboxRegex.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = checkboxRegex.exec(lineContent)) !== null) {
			const matchPos = line.from + match.index;
			const isChecked = match[1] === "x";

			// Only decorate if inside a table
			if (matchPos >= from && matchPos <= to && isInsideTable(view, matchPos)) {
				builder.add(
					matchPos,
					matchPos + 3,
					Decoration.replace({
						widget: new TableCheckboxWidget(isChecked),
					})
				);
			}
		}

		pos = line.to + 1;
	}

	return builder.finish();
}

const tableCheckboxExtension: Extension = [
	ViewPlugin.fromClass(
		class {
			decorations = Decoration.none;

			constructor(view: EditorView) {
				// Only create decorations in Live Preview mode
				const livePreview = view.state.field(editorLivePreviewField, false);
				if (livePreview) {
					this.decorations = buildDecorations(view);
				}
			}

			update(update: ViewUpdate) {
				const livePreview = update.view.state.field(editorLivePreviewField, false);
				if (!livePreview) {
					this.decorations = Decoration.none;
					return;
				}

				// Rebuild decorations on document changes or viewport changes
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildDecorations(update.view);
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
