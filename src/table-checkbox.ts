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

		// Store widget data on the checkbox so we can re-attach handlers after cloning
		(checkbox as any).dataset.decoratorPos = String(this.pos);
		(checkbox as any).dataset.decoratorCurrentChar = this.currentChar;
		(checkbox as any).dataset.decoratorViewId = "default"; // We'll need to track the view

		// Store view reference globally for access in fixAllTableCells
		if (!(window as any).decoratorViews) {
			(window as any).decoratorViews = new Map();
		}
		(window as any).decoratorViews.set("default", this.view);

		// Initial click handler (will be replaced after cloning)
		checkbox.addEventListener("click", (e: Event) => {
			console.log("[Decorator Widgets] Initial checkbox clicked!");
			e.preventDefault();
			e.stopPropagation();

			const newState = this.currentChar === " " ? "x" : " ";
			const transaction = this.view.state.update({
				changes: {
					from: this.pos,
					to: this.pos + 1,
					insert: newState,
				},
			});
			this.view.dispatch(transaction);
		});
		label.appendChild(checkbox);
		wrapper.appendChild(label);

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

	allTds.forEach((td) => {
		const originalCheckbox = td.querySelector(".decorator-widgets-checkbox") as HTMLInputElement;
		if (originalCheckbox && !td.hasAttribute("data-decorator-fixed")) {
			// Get the widget data from the checkbox
			const pos = parseInt(originalCheckbox.dataset.decoratorPos || "0");
			const currentChar = originalCheckbox.dataset.decoratorCurrentChar || " ";
			const viewId = originalCheckbox.dataset.decoratorViewId || "default";
			const view = (window as any).decoratorViews?.get(viewId);

			if (!view) {
				console.warn("[Decorator Widgets] No view found for checkbox!");
				return;
			}

			// Clone the td to remove all event listeners
			const clone = td.cloneNode(true) as HTMLElement;
			if (td.parentNode) {
				td.parentNode.replaceChild(clone, td);
			}

			// Mark as fixed
			clone.setAttribute("data-decorator-fixed", "true");

			// Get the cloned checkbox and fix it
			const checkbox = clone.querySelector(".decorator-widgets-checkbox") as HTMLInputElement;
			if (checkbox) {
				checkbox.disabled = false;
				checkbox.removeAttribute("disabled");

				// Re-attach click handler with the correct closure data
				checkbox.addEventListener("click", (e: Event) => {
					console.log("[Decorator Widgets] Cloned checkbox clicked!", { pos, currentChar });
					e.preventDefault();
					e.stopPropagation();

					const newState = currentChar === " " ? "x" : " ";
					console.log("[Decorator Widgets] Updating:", currentChar, "->", newState);

					const transaction = view.state.update({
						changes: {
							from: pos,
							to: pos + 1,
							insert: newState,
						},
					});
					view.dispatch(transaction);
				});

				console.log("[Decorator Widgets] Fixed cell, removed disabled, re-attached handler");
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
