import { Extension } from "@codemirror/state";
import { EditorView, Decoration, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";

class TableCheckboxWidget extends WidgetType {
	constructor(
		private readonly pos: number,
		private readonly currentChar: string,
		private readonly view: EditorView,
	) {
		super();
	}

	eq(other: TableCheckboxWidget): boolean {
		return other.currentChar === this.currentChar;
	}

	toDOM() {
		console.log(
			"[Decorator Widgets] Creating checkbox widget at pos",
			this.pos,
			"current:",
			this.currentChar,
		);
		const wrapper = document.createElement("span");
		wrapper.className = "task-list-item decorator-widgets-wrapper";

		const label = document.createElement("label");
		label.className = "task-list-label decorator-widgets-label";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "task-list-item-checkbox decorator-widgets-checkbox";
		checkbox.checked = this.currentChar !== " ";
		checkbox.tabIndex = -1;
		checkbox.disabled = false;
		checkbox.removeAttribute("disabled");

		// Click handler - will be re-attached after cloning
		const clickHandler = (e: Event) => {
			console.log("[Decorator Widgets] Checkbox clicked!");
			e.preventDefault();
			e.stopPropagation();

			const newState = this.currentChar === " " ? "x" : " ";
			console.log("[Decorator Widgets] Updating:", this.currentChar, "->", newState);
			const transaction = this.view.state.update({
				changes: {
					from: this.pos,
					to: this.pos + 1,
					insert: newState,
				},
			});
			this.view.dispatch(transaction);
		};

		checkbox.addEventListener("click", clickHandler);
		label.appendChild(checkbox);
		wrapper.appendChild(label);

		// Schedule fixing all table cells with our checkboxes
		// This runs after widgets are inserted into the DOM
		requestAnimationFrame(() => {
			fixAllTableCells();
		});
		setTimeout(() => fixAllTableCells(), 50);
		setTimeout(() => fixAllTableCells(), 100);

		return wrapper;
	}

	override ignoreEvent(): boolean {
		return false;
	}
}

// Global function to fix all table cells with our checkboxes
function fixAllTableCells() {
	const allTds = document.querySelectorAll("td");
	let fixedCount = 0;

	// Click handler - will be re-attached after cloning
	// const clickHandler = (e: Event) => {
	// 	console.log("[Decorator Widgets] Checkbox clicked!");
	// 	e.preventDefault();
	// 	e.stopPropagation();
	// 	e.target;

	// 	const newState = this.currentChar === " " ? "x" : " ";
	// 	console.log("[Decorator Widgets] Updating:", this.currentChar, "->", newState);
	// 	const transaction = this.view.state.update({
	// 		changes: {
	// 			from: this.pos,
	// 			to: this.pos + 1,
	// 			insert: newState,
	// 		},
	// 	});
	// 	this.view.dispatch(transaction);
	// };

	allTds.forEach((td) => {
		const hasOurCheckbox = td.querySelector(".decorator-widgets-checkbox");
		if (hasOurCheckbox && !td.hasAttribute("data-decorator-fixed")) {
			// Clone the td to remove all event listeners
			const clone = td.cloneNode(true) as HTMLElement;
			if (td.parentNode) {
				td.parentNode.replaceChild(clone, td);
			}

			// Mark as fixed
			clone.setAttribute("data-decorator-fixed", "true");

			// Remove disabled from our checkbox
			const checkbox = clone.querySelector(".decorator-widgets-checkbox") as HTMLInputElement;
			if (checkbox) {
				checkbox.disabled = false;
				checkbox.removeAttribute("disabled");
				// checkbox.addEventListener("click", clickHandler);
				console.log("[Decorator Widgets] Fixed cell, removed disabled");
			}
			fixedCount++;
		}
	});

	if (fixedCount > 0) {
		console.log(`[Decorator Widgets] Fixed ${fixedCount} table cells`);
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
			widget: new TableCheckboxWidget(pos, match[1], view),
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

				// Fix cells again after decorations update
				requestAnimationFrame(() => fixAllTableCells());
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

const tableCheckboxExtension: Extension = [decorationsPlugin];

export function registerTableCheckboxExtension(): Extension {
	return tableCheckboxExtension;
}
