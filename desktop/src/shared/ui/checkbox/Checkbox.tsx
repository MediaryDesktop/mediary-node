import clsx from 'clsx'

import { Icon } from '../icon/Icon'

import styles from './Checkbox.module.scss'

export type CheckboxState = boolean | 'mixed'

export interface CheckboxProps {
	checked: CheckboxState
	onCheckedChange: (checked: boolean) => void
	label: string
	disabled?: boolean
	className?: string
}

// A folder is checked when every file under it is, and "mixed" when only some
// are — clicking a mixed one selects the rest rather than clearing what is there.
export function Checkbox({ checked, onCheckedChange, label, disabled, className }: CheckboxProps) {
	return (
		<button
			type='button'
			role='checkbox'
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			className={clsx(styles.box, checked !== false && styles.on, className)}
			onClick={event => {
				event.stopPropagation()
				onCheckedChange(checked !== true)
			}}
		>
			{checked === true && <Icon name='common/check' size={12} />}
			{checked === 'mixed' && <span className={styles.dash} />}
		</button>
	)
}
