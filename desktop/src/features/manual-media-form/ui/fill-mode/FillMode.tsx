import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import styles from './FillMode.module.scss'

export type FillModeValue = 'ai' | 'manual'

export interface FillModeProps {
	value: FillModeValue
	onChange: (value: FillModeValue) => void
	disabled?: boolean
}

const OPTIONS = [
	{ value: 'ai', icon: 'common/wand-sparkles', labelKey: 'manualMedia.mode.ai' },
	{ value: 'manual', icon: 'common/pencil', labelKey: 'manualMedia.mode.manual' }
] as const

export function FillMode({ value, onChange, disabled }: FillModeProps) {
	const { t } = useTranslation()

	return (
		<div className={styles.root} role='radiogroup' aria-label={t('manualMedia.mode.label')}>
			{OPTIONS.map(option => (
				<button
					key={option.value}
					type='button'
					role='radio'
					aria-checked={value === option.value}
					className={clsx(styles.option, value === option.value && styles.active)}
					disabled={disabled}
					onClick={() => onChange(option.value)}
				>
					<Icon name={option.icon} size={16} />
					{t(option.labelKey)}
				</button>
			))}
		</div>
	)
}
