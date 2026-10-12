import clsx from 'clsx'

import { Icon } from '../../icon/Icon'
import { useRipple } from '../../ripple/lib/useRipple'
import type { SelectDropdownOption } from '../lib/logic'
import styles from '../SelectDropdown.module.scss'

export interface OptionProps {
	id: string
	option: SelectDropdownOption
	selected: boolean
	active: boolean
	multiple: boolean
	onSelect: (option: SelectDropdownOption) => void
	onHover: () => void
}

export function Option({ id, option, selected, active, multiple, onSelect, onHover }: OptionProps) {
	const ripple = useRipple<HTMLDivElement>({ disabled: option.disabled })

	return (
		<div
			ref={ripple}
			id={id}
			role='option'
			aria-selected={selected}
			aria-disabled={option.disabled || undefined}
			data-active={active}
			className={clsx(
				styles.option,
				selected && styles.isSelected,
				active && styles.isActive,
				option.disabled && styles.isDisabled
			)}
			onMouseMove={onHover}
			onMouseDown={event => event.preventDefault()}
			onClick={() => onSelect(option)}
		>
			{multiple && <span className={clsx(styles.checkbox, selected && styles.isChecked)} />}

			{option.icon && <Icon name={option.icon} size={20} className={styles.optionIcon} />}

			<span className={styles.optionText}>
				<span className={styles.optionLabel}>{option.label}</span>
				{option.description && <span className={styles.optionDescription}>{option.description}</span>}
			</span>

			{!multiple && selected && <Icon name='common/check' size={16} className={styles.check} />}
		</div>
	)
}
