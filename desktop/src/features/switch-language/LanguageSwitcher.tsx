import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, useTranslation } from '@shared/i18n'
import { SegmentedControl } from '@shared/ui'

export interface LanguageSwitcherProps {
	className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
	const { t, i18n } = useTranslation()

	const active = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE

	return (
		<SegmentedControl
			size='large'
			items={LANGUAGES.map(language => ({
				value: language,
				label: language.toUpperCase(),
				title: t(`language.${language}`)
			}))}
			value={active}
			onValueChange={language => void i18n.changeLanguage(language)}
			label={t('settings.language.name')}
			className={className}
		/>
	)
}
