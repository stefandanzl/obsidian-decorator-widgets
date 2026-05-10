import { Extension } from "@codemirror/state";
import { EditorView, Decoration, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

/**
 * Toggle the table checkbox at the current cursor position.
 * Only works if the cell contains ONLY [ ] or [x] (with optional whitespace).
 * Returns true if toggled, false otherwise.
 */
export function toggleTableCheckbox(view: EditorView): boolean {
	const pos = view.state.selection.main.from;
	const line = view.state.doc.lineAt(pos);
	const lineText = view.state.doc.sliceString(line.from, line.to);

	// Check if we're in a table
	if (!lineText.includes("|")) {
		return false;
	}

	// Find the table cell at cursor position
	const cellContent = extractCellContent(lineText, pos - line.from);
	if (!cellContent) {
		return false;
	}

	// Check if cell contains ONLY [ ] or [x] (with optional whitespace)
	const trimmedContent = cellContent.trim();
	const isCheckbox = /^\[([ x])\]$/.test(trimmedContent);

	if (!isCheckbox) {
		// Cell has other content, don't toggle
		return false;
	}

	// Toggle the checkbox state
	const currentState = trimmedContent.match(/\[([ x])\]/)?.[1] || " ";
	const newState = currentState === " " ? "x" : " ";

	// Find the position of the checkbox character
	const cellStart = findCellStart(lineText, pos - line.from);
	const checkboxMatch = lineText.slice(cellStart).match(/\[([ x])\]/);

	if (!checkboxMatch) {
		return false;
	}

	// Calculate the absolute position of the checkbox character
	const checkboxPos = line.from + cellStart + checkboxMatch.index! + 1;

	// Update the document
	const transaction = view.state.update({
		changes: {
			from: checkboxPos,
			to: checkboxPos + 1,
			insert: newState,
		},
	});

	view.dispatch(transaction);
	return true;
}

/**
 * Extract the content of the table cell at the given position in a line.
 */
function extractCellContent(lineText: string, pos: number): string | null {
	const cellStart = findCellStart(lineText, pos);
	const cellEnd = findCellEnd(lineText, pos);

	if (cellStart === -1 || cellEnd === -1) {
		return null;
	}

	return lineText.slice(cellStart, cellEnd);
}

/**
 * Find the start position of the table cell containing the given position.
 */
function findCellStart(lineText: string, pos: number): number {
	const beforePos = lineText.slice(0, pos);
	const lastPipe = beforePos.lastIndexOf("|");
	return lastPipe + 1;
}

/**
 * Find the end position of the table cell containing the given position.
 */
function findCellEnd(lineText: string, pos: number): number {
	const fromPos = lineText.slice(pos);
	const nextPipe = fromPos.indexOf("|");
	return nextPipe === -1 ? -1 : pos + nextPipe;
}

// ============================================================================
// VISUAL WIDGETS (read-only, no click handling)
// ============================================================================

class TableCheckboxWidget extends WidgetType {
	constructor(private readonly currentChar: string) {
		super();
	}

	eq(other: TableCheckboxWidget): boolean {
		return other.currentChar === this.currentChar;
	}

	toDOM() {
		const wrapper = document.createElement("span");
		wrapper.className = "task-list-item decorator-widgets-wrapper";

		const label = document.createElement("label");
		label.className = "task-list-label decorator-widgets-label";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "task-list-item-checkbox decorator-widgets-checkbox";
		checkbox.checked = this.currentChar !== " ";
		checkbox.tabIndex = -1;
		checkbox.disabled = true; // Always disabled - use hotkey instead

		label.appendChild(checkbox);
		wrapper.appendChild(label);

		return wrapper;
	}

	override ignoreEvent(): boolean {
		return true;
	}
}

const checkboxDecorator = new MatchDecorator({
	regexp: /\[([ x])\]/g,
	decoration: (match, view, pos) => {
		const line = view.state.doc.lineAt(pos);
		const lineText = view.state.doc.sliceString(line.from, line.to);

		if (!lineText.includes("|")) {
			return null;
		}

		return Decoration.replace({
			widget: new TableCheckboxWidget(match[1]),
		});
	},
});

const decorationsPlugin = ViewPlugin.fromClass(
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

			if (update.docChanged || update.viewportChanged) {
				this.decorations = checkboxDecorator.updateDeco(update, this.decorations);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

export const tableCheckboxExtension: Extension = [decorationsPlugin];
