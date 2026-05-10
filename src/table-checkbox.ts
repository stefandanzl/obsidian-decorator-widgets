import { Extension } from "@codemirror/state";
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { editorLivePreviewField } from "obsidian";

class TableCheckboxWidget extends WidgetType {
	constructor(
		private readonly view: EditorView,
		private readonly pos: number,
		private readonly currentChar: string,
	) {
		super();
	}

	toDOM() {
		const wrapper = document.createElement("span");
		wrapper.className = "task-list-item decorator-widgets-wrapper";

		const label = document.createElement("label");
		label.className = "task-list-label decorator-widgets-label";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "task-list-item-checkbox decorator-widgets-checkbox";
		checkbox.setAttribute("data-task", this.currentChar);

		// Set checked state based on character (only space means unchecked)
		checkbox.checked = this.currentChar !== " ";

		// Prevent focus and cursor movement
		checkbox.tabIndex = -1;

		checkbox.onmousedown = (e: MouseEvent) => {
			e.preventDefault();
		};

		checkbox.onclick = (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			// Toggle between [ ] and [x]
			const newChar = checkbox.checked ? "x" : " ";
			this.toggleCheckbox(newChar);
		};

		label.appendChild(checkbox);
		wrapper.appendChild(label);

		return wrapper;
	}

	private toggleCheckbox(newChar: string) {
		const line = this.view.state.doc.lineAt(this.pos);
		const lineContent = this.view.state.doc.sliceString(line.from, line.to);

		// Find the checkbox in the line
		const checkboxRegex = /\[[^\]|]\]/g;
		let match: RegExpExecArray | null;

		while ((match = checkboxRegex.exec(lineContent)) !== null) {
			const absPos = line.from + match.index;
			if (absPos === this.pos) {
				// Don't change selection - let CM6 handle it since replacement is same length
				this.view.dispatch({
					changes: {
						from: absPos,
						to: absPos + 3,
						insert: `[${newChar}]`,
					},
					userEvent: "input",
					scrollIntoView: false,
				});
				break;
			}
		}
	}

	override ignoreEvent(): boolean {
		return false;
	}
}

function isInsideTable(view: EditorView, pos: number): boolean {
	const line = view.state.doc.lineAt(pos);
	const lineText = view.state.doc.sliceString(line.from, line.to);

	// Check if this line is part of a table by looking for pipe characters
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
			// If we found the start marker before our position, we're inside
			insideCodeBlock = currentLine.from < line.from;
			break;
		}

		if (currentLine.from === 0) break;

		currentLine = doc.lineAt(currentLine.from - 1);
		linesChecked++;
	}

	return insideCodeBlock;
}

const tableCheckboxExtension = [
	EditorView.decorations.of((view: EditorView) => {
		console.log("[cm6] livePreview:", view.state.field(editorLivePreviewField, false));

		const builder = new RangeSetBuilder<Decoration>();

		// Only scan visible viewport for performance
		const { from, to } = view.viewport;

		const doc = view.state.doc;
		const checkboxRegex = /\[[^\]|]\]/g;

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
				const char = match[0][1];

				// Only decorate if inside a table and within viewport
				if (matchPos >= from && matchPos <= to && isInsideTable(view, matchPos)) {
					const decoration = Decoration.replace({
						widget: new TableCheckboxWidget(view, matchPos, char),
					});
					builder.add(matchPos, matchPos + 3, decoration);
				}
			}

			pos = line.to + 1;
		}

		return builder.finish();
	}),
];

export function registerTableCheckboxExtension(): Extension {
	return tableCheckboxExtension;
}
