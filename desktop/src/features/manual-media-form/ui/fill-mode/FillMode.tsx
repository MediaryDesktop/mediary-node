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

export function FillMode({ value, onChange, disabled }: FillModeProps) {
	const { t } = useTranslation()

	const options: {
		value: FillModeValue
		icon: 'common/wand-sparkles' | 'common/pencil'
		labelKey: string
		hintKey: string
	}[] = [
		{
			value: 'ai',
			icon: 'common/wand-sparkles',
			labelKey: 'manualMedia.mode.ai',
			hintKey: 'manualMedia.mode.aiHint'
		},
		{
			value: 'manual',
			icon: 'common/pencil',
			labelKey: 'manualMedia.mode.manual',
			hintKey: 'manualMedia.mode.manualHint'
		}
	]

	return (
		<div className={styles.root} role='radiogroup' aria-label={t('manualMedia.mode.label')}>
			{options.map(option => (
				<button
					key={option.value}
					type='button'
					role='radio'
					aria-checked={value === option.value}
					className={clsx(styles.option, value === option.value && styles.active)}
					disabled={disabled}
					onClick={() => onChange(option.value)}
				>
					<Icon name={option.icon} size={18} />
					<span className={styles.text}>
						<span className={styles.label}>{t(option.labelKey as never)}</span>
						<span className={styles.hint}>{t(option.hintKey as never)}</span>
					</span>
				</button>
			))}
		</div>
	)
}
