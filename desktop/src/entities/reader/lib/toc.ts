import type { FoliateTocItem } from 'foliate-js/view.js'

export interface TocIndex {
	// Each item's place in reading order, nested chapters included.
	numbers: WeakMap<FoliateTocItem, number>
	total: number
	// The current chapter's place in that same order, or null while unmatched.
	current: number | null
}

export function indexToc(items: FoliateTocItem[], current: string | null): TocIndex {
	const numbers = new WeakMap<FoliateTocItem, number>()
	let total = 0
	let currentNumber: number | null = null

	const walk = (list: FoliateTocItem[]) => {
		for (const item of list) {
			total += 1
			numbers.set(item, total)

			if (currentNumber == null && current != null && item.label.trim() === current) {
				currentNumber = total
			}

			if (item.subitems && item.subitems.length > 0) {
				walk(item.subitems)
			}
		}
	}

	walk(items)

	return { numbers, total, current: currentNumber }
}
