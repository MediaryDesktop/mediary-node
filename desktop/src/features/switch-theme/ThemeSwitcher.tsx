import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { setTheme, type Theme, THEMES, useTheme } from '@shared/style/theme'
import { Icon, type IconName } from '@shared/ui'

import styles from './ThemeSwitcher.module.scss'

const ICONS: Record<Theme, IconName> = {
	dark: 'common/moon',
	light: 'common/sun'
}

export interface ThemeSwitcherProps {
	className?: string
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
	const { t } = useTranslation()
	const theme = useTheme()

	return (
		<div className={clsx(styles.root, className)} role='group' aria-label={t('theme.label')}>
			{THEMES.map(option => {
				const active = theme === option
				const label = t(`theme.${option}`)

				return (
					<button
						key={option}
						type='button'
						className={clsx(styles.option, active && styles.active)}
						aria-pressed={active}
						title={label}
						aria-label={label}
						onClick={() => setTheme(option)}
					>
						<Icon name={ICONS[option]} size={16} />
					</button>
				)
			})}
		</div>
	)
}
