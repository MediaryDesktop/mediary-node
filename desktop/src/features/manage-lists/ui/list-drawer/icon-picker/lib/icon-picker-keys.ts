import type { KeyboardEvent, RefObject } from 'react'

interface IconPickerKeysOptions {
	searchRef: RefObject<HTMLInputElement | null>
	gridRef: RefObject<HTMLDivElement | null>
	value: string
	options: string[]
	onChoose: (icon: string) => void
	onClose: () => void
}

// A key pressed in the open picker. In the search field: ↓ goes to the chosen
// icon (or the first), Enter takes the first match. In the grid: arrows move
// by cell and by row, ↑ from the top row returns to the search. Escape closes
// either.
export function handleIconPickerKey(
	event: KeyboardEvent<HTMLDivElement>,
	{ searchRef, gridRef, value, options, onChoose, onClose }: IconPickerKeysOptions
): void {
	const cells = () => Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])

	const focusCell = (index: number) => {
		const all = cells()
		all[Math.min(Math.max(index, 0), all.length - 1)]?.focus()
	}

	if (event.key === 'Escape') {
		event.preventDefault()
		onClose()
		return
	}

	if (event.target === searchRef.current) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			const all = cells()
			const current = all.findIndex(cell => cell.dataset.icon === value)
			focusCell(current >= 0 ? current : 0)
		} else if (event.key === 'Enter') {
			event.preventDefault()
			const first = options[0]
			if (first !== undefined) {
				onChoose(first)
			}
		}
		return
	}

	const all = cells()
	const at = all.findIndex(cell => cell === document.activeElement)
	if (at < 0) {
		return
	}

	const top = all[0]?.offsetTop ?? 0
	const columns = Math.max(all.filter(cell => cell.offsetTop === top).length, 1)

	const step: Record<string, number> = {
		ArrowRight: 1,
		ArrowLeft: -1,
		ArrowDown: columns,
		ArrowUp: -columns
	}

	const delta = step[event.key]
	if (delta === undefined) {
		return
	}

	event.preventDefault()

	if (event.key === 'ArrowUp' && at < columns) {
		searchRef.current?.focus()
		return
	}

	focusCell(at + delta)
}
