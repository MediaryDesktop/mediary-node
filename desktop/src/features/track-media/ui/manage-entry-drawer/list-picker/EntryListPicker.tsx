import clsx from 'clsx'
import { FaBookmark, FaRegBookmark } from 'react-icons/fa6'

import { useRipple } from '@shared/ui'

import styles from './EntryListPicker.module.scss'

export interface EntryListPickerProps {
	options: { value: string; label: string }[]
	selected: string[]
	disabled?: boolean
	onChange: (selected: string[]) => void
}

interface ListRowProps {
	label: string
	checked: boolean
	disabled?: boolean
	onToggle: () => void
}

function ListRow({ label, checked, disabled, onToggle }: ListRowProps) {
	const ripple = useRipple<HTMLButtonElement>({ disabled })

	return (
		<button
			ref={ripple}
			type='button'
			className={clsx(styles.row, checked && styles.checked)}
			aria-pressed={checked}
			disabled={disabled}
			onClick={onToggle}
		>
			<span className={styles.label}>{label}</span>
			<span className={styles.icon} aria-hidden>
				{checked ? <FaBookmark size={18} /> : <FaRegBookmark size={18} />}
			</span>
		</button>
	)
}

export function EntryListPicker({ options, selected, disabled, onChange }: EntryListPickerProps) {
	const toggle = (value: string) => {
		onChange(selected.includes(value) ? selected.filter(name => name !== value) : [...selected, value])
	}

	return (
		<div className={styles.root}>
			{options.map(option => (
				<ListRow
					key={option.value}
					label={option.label}
					checked={selected.includes(option.value)}
					disabled={disabled}
					onToggle={() => toggle(option.value)}
				/>
			))}
		</div>
	)
}
