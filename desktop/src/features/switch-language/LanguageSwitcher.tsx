import clsx from 'clsx'

import { LANGUAGES, useTranslation } from '@shared/i18n'

import styles from './LanguageSwitcher.module.scss'

export interface LanguageSwitcherProps {
	className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
	const { t, i18n } = useTranslation()

	return (
		<div className={clsx(styles.root, className)}>
			{LANGUAGES.map(language => {
				const active = i18n.resolvedLanguage === language

				return (
					<button
						key={language}
						type='button'
						className={clsx(styles.option, active && styles.active)}
						aria-pressed={active}
						title={t(`language.${language}`)}
						onClick={() => void i18n.changeLanguage(language)}
					>
						{language}
					</button>
				)
			})}
		</div>
	)
}
