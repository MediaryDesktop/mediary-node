import * as Menu from '@radix-ui/react-dropdown-menu'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { $playerMode, PLAYER_MODES, playerModeChanged } from '@entities/playback'
import type { PlayerMode } from '@entities/playback'

import styles from '../PlayMenu.module.scss'

export function PlayerModeMenu() {
	const { t } = useTranslation()
	const [playerMode, changePlayerMode] = useUnit([$playerMode, playerModeChanged])

	return (
		<Menu.Sub>
			<Menu.SubTrigger className={styles.item}>
				<Icon name='common/player' size={16} className={styles.icon} />
				<span className={styles.text}>{t('media.card.menu.player')}</span>
				<span className={styles.value}>{t(`settings.player.modes.${playerMode}`)}</span>
			</Menu.SubTrigger>

			<Menu.Portal>
				<Menu.SubContent className={styles.menu} sideOffset={8} collisionPadding={12}>
					<Menu.RadioGroup
						value={playerMode}
						onValueChange={value => changePlayerMode(value as PlayerMode)}
					>
						{PLAYER_MODES.map(mode => (
							<Menu.RadioItem
								key={mode}
								value={mode}
								className={styles.item}
								onSelect={event => event.preventDefault()}
							>
								<span className={styles.text}>{t(`settings.player.modes.${mode}`)}</span>
								<Menu.ItemIndicator className={styles.aside}>
									<Icon name='common/check' size={14} />
								</Menu.ItemIndicator>
							</Menu.RadioItem>
						))}
					</Menu.RadioGroup>
				</Menu.SubContent>
			</Menu.Portal>
		</Menu.Sub>
	)
}
