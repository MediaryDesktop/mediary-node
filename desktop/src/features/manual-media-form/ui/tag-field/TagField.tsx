import type { KeyboardEvent } from 'react'
import { useState } from 'react'

import { Icon } from '@shared/ui'

import styles from './TagField.module.scss'

export interface TagFieldProps {
	value: string[]
	onChange: (next: string[]) => void
	placeholder?: string
	disabled?: boolean
	maxItems?: number
	onDraftChange?: (draft: string) => void
}

export function TagField({
	value,
	onChange,
	placeholder,
	disabled,
	maxItems = 30,
	onDraftChange
}: TagFieldProps) {
	const [draft, setDraft] = useState('')

	const updateDraft = (next: string) => {
		setDraft(next)
		onDraftChange?.(next)
	}

	const commit = () => {
		const tag = draft.trim()
		updateDraft('')

		if (tag === '' || value.includes(tag) || value.length >= maxItems) {
			return
		}

		onChange([...value, tag])
	}

	const remove = (tag: string) => onChange(value.filter(item => item !== tag))

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault()
			commit()
			return
		}

		if (event.key === 'Backspace' && draft === '' && value.length > 0) {
			event.preventDefault()
			remove(value[value.length - 1]!)
		}
	}

	return (
		<div className={styles.field}>
			{value.map(tag => (
				<span key={tag} className={styles.tag}>
					{tag}

					{!disabled && (
						<button type='button' className={styles.remove} onClick={() => remove(tag)}>
							<Icon name='common/close' size={12} />
						</button>
					)}
				</span>
			))}

			{!disabled && value.length < maxItems && (
				<input
					className={styles.input}
					value={draft}
					onChange={event => updateDraft(event.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={commit}
					placeholder={value.length === 0 ? placeholder : undefined}
					disabled={disabled}
				/>
			)}
		</div>
	)
}
