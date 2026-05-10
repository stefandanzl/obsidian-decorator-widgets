import type MyPlugin from "./main";

const CHECKBOX_RE = /\[(.)\]/g;
const SKIP_TAGS = new Set(["CODE", "PRE", "A", "SCRIPT", "STYLE", "KBD"]);

export function registerPreviewProcessor(plugin: MyPlugin): void {
	plugin.registerMarkdownPostProcessor((element) => {
		// Live Preview: element itself is a single table cell wrapper
		if (element.matches?.(".table-cell-wrapper")) {
			transformCell(element);
			return;
		}

		// Reading mode: find every cell inside any table
		element.querySelectorAll<HTMLElement>("table td, table th").forEach(transformCell);
	});
}

function transformCell(cell: HTMLElement): void {
	const textNodes: Text[] = [];
	collectTextNodes(cell, textNodes);
	textNodes.forEach(replaceCheckboxesInTextNode);
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

function replaceCheckboxesInTextNode(textNode: Text): void {
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
		frag.appendChild(buildCheckbox(m[1]));
		lastIndex = m.index + m[0].length;
	}
	if (lastIndex < text.length) {
		frag.appendChild(document.createTextNode(text.slice(lastIndex)));
	}
	textNode.parentNode?.replaceChild(frag, textNode);
}

function buildCheckbox(char: string): HTMLElement {
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
	input.disabled = true;
	if (char !== " ") input.checked = true;

	return wrapper;
}
