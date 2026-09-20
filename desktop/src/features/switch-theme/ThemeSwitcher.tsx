import { useTranslation } from '@shared/i18n'
import { setTheme, type Theme, THEMES, useTheme } from '@shared/style/theme'
import { Icon, type IconName, SegmentedControl } from '@shared/ui'

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
		<SegmentedControl
			items={THEMES.map(option => ({
				value: option,
				label: <Icon name={ICONS[option]} size={16} />,
				ariaLabel: t(`theme.${option}`)
			}))}
			value={theme}
			onValueChange={setTheme}
			label={t('theme.label')}
			className={className}
		/>
	)
}
