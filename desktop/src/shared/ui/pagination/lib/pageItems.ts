export type PageItem = number | 'gap'

export function pageItems(page: number, pages: number): PageItem[] {
	if (pages <= 7) {
		return Array.from({ length: pages }, (_, i) => i + 1)
	}

	const near = new Set([1, pages, page - 1, page, page + 1])
	if (page <= 3) {
		;[2, 3, 4].forEach(n => near.add(n))
	}
	if (page >= pages - 2) {
		;[pages - 3, pages - 2, pages - 1].forEach(n => near.add(n))
	}

	const shown = [...near].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)
	const items: PageItem[] = []

	for (const n of shown) {
		const previous = items.at(-1)
		if (typeof previous === 'number' && n - previous > 1) {
			items.push(n - previous === 2 ? previous + 1 : 'gap')
		}
		items.push(n)
	}

	return items
}
