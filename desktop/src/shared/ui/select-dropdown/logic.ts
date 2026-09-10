import type { IconName } from '../icon/Icon'

export interface SelectDropdownOption {
	value: string
	label: string
	description?: string
	icon?: IconName
	disabled?: boolean
}

export type SelectAction =
	'open' | 'close' | 'dismiss' | 'next' | 'previous' | 'first' | 'last' | 'select' | 'removeLast'

export interface SelectKeyContext {
	open: boolean
	searchable: boolean
	multiple: boolean
	hasQuery: boolean
	hasSelection: boolean
}

export function selectedOptionsOf(
	options: SelectDropdownOption[],
	selected: string[]
): SelectDropdownOption[] {
	const byValue = new Map(options.map(option => [option.value, option]))

	return selected.flatMap(value => {
		const option = byValue.get(value)

		return option ? [option] : []
	})
}

export function filterOptions(options: SelectDropdownOption[], query: string): SelectDropdownOption[] {
	const term = query.trim().toLowerCase()

	if (!term) {
		return options
	}

	return options.filter(
		option =>
			option.label.toLowerCase().includes(term) || option.description?.toLowerCase().includes(term)
	)
}

export function activeIndexOf(options: SelectDropdownOption[], preferred: string | undefined): number {
	const preferredIndex = options.findIndex(option => option.value === preferred && !option.disabled)

	if (preferredIndex !== -1) {
		return preferredIndex
	}

	return Math.max(
		0,
		options.findIndex(option => !option.disabled)
	)
}

export function stepIndex(options: SelectDropdownOption[], from: number, direction: 1 | -1): number | null {
	let next = from

	for (let attempt = 0; attempt < options.length; attempt += 1) {
		next = (next + direction + options.length) % options.length

		if (!options[next]?.disabled) {
			return next
		}
	}

	return null
}

export function edgeIndex(options: SelectDropdownOption[], edge: 'first' | 'last'): number | null {
	if (edge === 'first') {
		const index = options.findIndex(option => !option.disabled)

		return index === -1 ? null : index
	}

	for (let index = options.length - 1; index >= 0; index -= 1) {
		if (!options[index]?.disabled) {
			return index
		}
	}

	return null
}

export function resolveKeyAction(key: string, context: SelectKeyContext): SelectAction | null {
	const { open, searchable, multiple, hasQuery, hasSelection } = context

	switch (key) {
		case 'ArrowDown':
			return open ? 'next' : 'open'

		case 'ArrowUp':
			return open ? 'previous' : 'open'

		case 'Home':
			return open ? 'first' : null

		case 'End':
			return open ? 'last' : null

		case 'Enter':
			return open ? 'select' : 'open'

		case ' ':
			if (searchable && open) {
				return null
			}

			return open ? 'select' : 'open'

		case 'Escape':
			return open ? 'dismiss' : null

		case 'Tab':
			return open ? 'close' : null

		case 'Backspace':
			return multiple && !hasQuery && hasSelection ? 'removeLast' : null

		default:
			return null
	}
}
