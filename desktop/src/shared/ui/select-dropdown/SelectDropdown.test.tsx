import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

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
