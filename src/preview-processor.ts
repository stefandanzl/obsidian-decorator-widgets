import type MyPlugin from "./main";

export function registerPreviewProcessor(plugin: MyPlugin): void {
	plugin.registerMarkdownPostProcessor((element) => {
		// Find all tables in the rendered content
		const tables = element.querySelectorAll("table");

		tables.forEach((table) => {
			// Collect all cell contents that might have checkboxes
			const cells = table.querySelectorAll("td, th");

			cells.forEach((cell) => {
				const cellText = cell.textContent || "";
				const checkboxRegex = /\[[^\]|]\]/g;

				// Check if this cell contains checkbox patterns
				if (checkboxRegex.test(cellText)) {
					checkboxRegex.lastIndex = 0;

					// Get the HTML content of the cell
					const cellHTML = cell.innerHTML;
					let newHTML = cellHTML;
					let matchCount = 0;

					// Replace each checkbox with a visual widget (no interactivity)
					newHTML = newHTML.replace(/\[[^\]|]\]/g, (match) => {
						matchCount++;
						const char = match[1];
						const checked = char !== " ";

						// Render checkbox as read-only visual element
						return `<span class="task-list-item decorator-widgets-wrapper">
							<label class="task-list-label decorator-widgets-label">
								<input type="checkbox"
									class="task-list-item-checkbox decorator-widgets-checkbox"
									data-task="${char}"
									disabled
									${checked ? "checked" : ""}>
							</label>
						</span>`;
					});

					// Update the cell HTML if we made replacements
					if (matchCount > 0) {
						cell.innerHTML = newHTML;
					}
				}
			});
		});
	});
}
