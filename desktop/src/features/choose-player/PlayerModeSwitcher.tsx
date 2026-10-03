import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { SegmentedControl } from '@shared/ui'

import { $playerMode, PLAYER_MODES, playerModeChanged } from '@entities/playback'

export function PlayerModeSwitcher() {
	const { t } = useTranslation()
	const [mode, change] = useUnit([$playerMode, playerModeChanged])

	return (
		<SegmentedControl
			items={PLAYER_MODES.map(value => ({ value, label: t(`settings.player.modes.${value}`) }))}
			value={mode}
			onValueChange={change}
			label={t('settings.player.name')}
		/>
	)
}
