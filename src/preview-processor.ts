import type MyPlugin from "./main";
import { MarkdownPostProcessorContext } from "obsidian";

const CHECKBOX_RE = /\[(.)\]/g;
const SKIP_TAGS = new Set(["CODE", "PRE", "A", "SCRIPT", "STYLE", "KBD"]);

export function registerPreviewProcessor(plugin: MyPlugin): void {
	plugin.registerMarkdownPostProcessor((element, ctx) => {
		console.log("[Decorator Widgets] Preview processor called");

		if (element.matches?.(".table-cell-wrapper")) {
			transformCell(element, ctx, plugin);
			return;
		}
		element
			.querySelectorAll<HTMLElement>("table td, table th")
			.forEach((cell) => transformCell(cell, ctx, plugin));
	});
}

function transformCell(cell: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: MyPlugin): void {
	const textNodes: Text[] = [];
	collectTextNodes(cell, textNodes);
	textNodes.forEach((tn) => replaceCheckboxesInTextNode(tn, ctx, plugin));
}

function collectTextNodes(node: Node, out: Text[]): void {
	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			out.push(child as Text);
		} else if (child.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has((child as Element).tagName)) {
			collectTextNodes(child, out);
		}
	}
}

function replaceCheckboxesInTextNode(
	textNode: Text,
	ctx: MarkdownPostProcessorContext,
	plugin: MyPlugin,
): void {
	const text = textNode.nodeValue;
	if (!text || !text.includes("[")) return;

	CHECKBOX_RE.lastIndex = 0;
	if (!CHECKBOX_RE.test(text)) return;
	CHECKBOX_RE.lastIndex = 0;

	const frag = document.createDocumentFragment();
	let lastIndex = 0;
	let m: RegExpExecArray | null;

	while ((m = CHECKBOX_RE.exec(text)) !== null) {
		if (m.index > lastIndex) {
			frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
		}
		frag.appendChild(buildCheckbox(m[1], ctx, plugin));
		lastIndex = m.index + m[0].length;
	}
	if (lastIndex < text.length) {
		frag.appendChild(document.createTextNode(text.slice(lastIndex)));
	}
	textNode.parentNode?.replaceChild(frag, textNode);
}

function buildCheckbox(char: string, ctx: MarkdownPostProcessorContext, plugin: MyPlugin): HTMLElement {
	const wrapper = document.createElement("span");
	wrapper.className = "task-list-item decorator-widgets-wrapper";
	wrapper.dataset.task = char;

	const label = wrapper.createEl("label", {
		cls: "task-list-label decorator-widgets-label",
	});
	const input = label.createEl("input", {
		cls: "task-list-item-checkbox decorator-widgets-checkbox",
		type: "checkbox",
	});
	input.dataset.task = char;
	if (char !== " ") input.checked = true;

	// Always disabled in preview mode (read-only)
	input.disabled = true;

	console.log("[Decorator Widgets] Created read-only checkbox for preview");

	return wrapper;
}
