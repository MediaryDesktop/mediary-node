import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { resolveKeyAction, stepIndex } from './lib/logic'
import { SelectDropdown } from './SelectDropdown'
import type { SelectDropdownOption } from './SelectDropdown'

const OPTIONS: SelectDropdownOption[] = [
	{ value: 'mpv', label: 'mpv' },
	{ value: 'vlc', label: 'VLC', description: 'Plays anything' },
	{ value: 'custom', label: 'Custom player' },
	{ value: 'legacy', label: 'Legacy player', disabled: true }
]

function openMenu() {
	fireEvent.click(screen.getByRole('combobox'))
}

interface SingleProps {
	onChange?: (value: string | null) => void
	searchable?: boolean
	clearable?: boolean
}

function Single({ onChange = vi.fn(), ...rest }: SingleProps = {}) {
	const [value, setValue] = useState<string | null>(null)

	return (
		<SelectDropdown
			options={OPTIONS}
			value={value}
			onChange={next => {
				setValue(next)
				onChange(next)
			}}
			{...rest}
		/>
	)
}

function Multiple({ onChange = vi.fn() }: { onChange?: (value: string[]) => void } = {}) {
	const [value, setValue] = useState<string[]>([])

	return (
		<SelectDropdown
			mode='multiple'
			options={OPTIONS}
			value={value}
			onChange={next => {
				setValue(next)
				onChange(next)
			}}
		/>
	)
}

describe('single mode', () => {
	it('stays closed until it is asked to open', () => {
		render(<Single />)

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
		expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')

		openMenu()

		expect(screen.getByRole('listbox')).toBeInTheDocument()
		expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length)
	})

	it('reports the chosen value and closes', () => {
		const onChange = vi.fn()
		render(<Single onChange={onChange} />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /VLC/ }))

		expect(onChange).toHaveBeenCalledWith('vlc')
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
		expect(screen.getByRole('combobox')).toHaveValue('VLC')
	})

	it('picks the active option with the keyboard', () => {
		const onChange = vi.fn()
		render(<Single onChange={onChange} />)

		const combobox = screen.getByRole('combobox')

		fireEvent.keyDown(combobox, { key: 'ArrowDown' })
		fireEvent.keyDown(combobox, { key: 'ArrowDown' })
		fireEvent.keyDown(combobox, { key: 'Enter' })

		expect(onChange).toHaveBeenCalledWith('vlc')
	})

	it('skips disabled options while moving', () => {
		const onChange = vi.fn()
		render(<Single onChange={onChange} />)

		const combobox = screen.getByRole('combobox')

		fireEvent.keyDown(combobox, { key: 'ArrowDown' })
		fireEvent.keyDown(combobox, { key: 'End' })
		fireEvent.keyDown(combobox, { key: 'ArrowDown' })
		fireEvent.keyDown(combobox, { key: 'Enter' })

		expect(onChange).toHaveBeenCalledWith('mpv')
	})

	it('refuses a disabled option on click', () => {
		const onChange = vi.fn()
		render(<Single onChange={onChange} />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /Legacy/ }))

		expect(onChange).not.toHaveBeenCalled()
		expect(screen.getByRole('listbox')).toBeInTheDocument()
	})

	it('closes on Escape and on a click outside', () => {
		render(<Single />)

		openMenu()
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

		openMenu()
		fireEvent.pointerDown(document.body)
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
	})
})

describe('search', () => {
	it('filters by label and by description', () => {
		render(<Single searchable />)

		const combobox = screen.getByRole('combobox')

		openMenu()
		fireEvent.change(combobox, { target: { value: 'play' } })

		expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
			'VLCPlays anything',
			'Custom player',
			'Legacy player'
		])

		fireEvent.change(combobox, { target: { value: 'kodi' } })

		expect(screen.queryAllByRole('option')).toHaveLength(0)
		expect(screen.getByText('Nothing found')).toBeInTheDocument()
	})

	it('leaves the query out of the value once a choice is made', () => {
		render(<Single searchable />)

		openMenu()
		fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vl' } })
		fireEvent.click(screen.getByRole('option', { name: /VLC/ }))

		expect(screen.getByRole('combobox')).toHaveValue('VLC')
	})
})

describe('multiple mode', () => {
	it('accumulates values and keeps the menu open', () => {
		const onChange = vi.fn()
		render(<Multiple onChange={onChange} />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /mpv/ }))
		fireEvent.click(screen.getByRole('option', { name: /VLC/ }))

		expect(onChange).toHaveBeenNthCalledWith(1, ['mpv'])
		expect(onChange).toHaveBeenNthCalledWith(2, ['mpv', 'vlc'])
		expect(screen.getByRole('listbox')).toBeInTheDocument()
	})

	it('toggles a value off when it is picked again', () => {
		const onChange = vi.fn()
		render(<Multiple onChange={onChange} />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /mpv/ }))
		fireEvent.click(screen.getByRole('option', { name: /mpv/ }))

		expect(onChange).toHaveBeenLastCalledWith([])
	})

	it('shows tags in the order they were picked, not in the order of the options', () => {
		const onChange = vi.fn()
		render(<Multiple onChange={onChange} />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /Custom player/ }))
		fireEvent.click(screen.getByRole('option', { name: /mpv/ }))

		expect(screen.getAllByRole('button', { name: /^Remove/ }).map(button => button.ariaLabel)).toEqual([
			'Remove Custom player',
			'Remove mpv'
		])

		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })

		expect(onChange).toHaveBeenLastCalledWith(['custom'])
	})

	it('drops the last tag on Backspace with an empty query', () => {
		const onChange = vi.fn()
		render(<Multiple onChange={onChange} />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /mpv/ }))
		fireEvent.click(screen.getByRole('option', { name: /VLC/ }))
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })

		expect(onChange).toHaveBeenLastCalledWith(['mpv'])
	})
})

describe('clearing', () => {
	it('empties the selection', () => {
		const onChange = vi.fn()
		render(<Single onChange={onChange} clearable />)

		openMenu()
		fireEvent.click(screen.getByRole('option', { name: /VLC/ }))

		fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))

		expect(onChange).toHaveBeenLastCalledWith(null)
		expect(screen.getByRole('combobox')).toHaveValue('')
	})
})

describe('resolveKeyAction', () => {
	const closed = { open: false, searchable: false, multiple: false, hasQuery: false, hasSelection: false }
	const opened = { ...closed, open: true }

	it.each([
		['ArrowDown', closed, 'open'],
		['ArrowDown', opened, 'next'],
		['ArrowUp', opened, 'previous'],
		['Home', closed, null],
		['Home', opened, 'first'],
		['End', opened, 'last'],
		['Enter', closed, 'open'],
		['Enter', opened, 'select'],
		['Escape', closed, null],
		['Escape', opened, 'dismiss'],
		['Tab', opened, 'close'],
		['a', opened, null]
	])('maps %s to %s', (key, context, expected) => {
		expect(resolveKeyAction(key, context)).toBe(expected)
	})

	it('types a space instead of selecting only while searching', () => {
		expect(resolveKeyAction(' ', opened)).toBe('select')
		expect(resolveKeyAction(' ', { ...opened, searchable: true })).toBeNull()
		expect(resolveKeyAction(' ', { ...closed, searchable: true })).toBe('open')
	})

	it('removes the last value only when a multiple select has nothing to erase', () => {
		const multiple = { ...opened, multiple: true, hasSelection: true }

		expect(resolveKeyAction('Backspace', multiple)).toBe('removeLast')
		expect(resolveKeyAction('Backspace', { ...multiple, hasQuery: true })).toBeNull()
		expect(resolveKeyAction('Backspace', { ...multiple, hasSelection: false })).toBeNull()
		expect(resolveKeyAction('Backspace', { ...opened, hasSelection: true })).toBeNull()
	})
})

describe('stepIndex', () => {
	const options = [
		{ value: 'a', label: 'A' },
		{ value: 'b', label: 'B', disabled: true },
		{ value: 'c', label: 'C' }
	]

	it('wraps around and skips what is disabled', () => {
		expect(stepIndex(options, 0, 1)).toBe(2)
		expect(stepIndex(options, 2, 1)).toBe(0)
		expect(stepIndex(options, 0, -1)).toBe(2)
	})

	it('gives up when nothing can be reached', () => {
		expect(stepIndex([{ value: 'a', label: 'A', disabled: true }], 0, 1)).toBeNull()
		expect(stepIndex([], 0, 1)).toBeNull()
	})
})
