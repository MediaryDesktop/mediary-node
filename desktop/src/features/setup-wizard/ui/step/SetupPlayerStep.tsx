import { useId, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, SelectDropdown } from '@shared/ui'

import { SetupCard } from '../layout'

import styles from './SetupPlayerStep.module.scss'

export function SetupPlayerStep() {
	const { t } = useTranslation()
	const id = useId()
	const [player, setPlayer] = useState<string | null>('mpv')

	return (
		<>
			<div className={styles.notice}>
				<Icon name='common/info' size={18} className={styles.icon} />
				<p className={styles.text}>{t('setup.player.notice')}</p>
			</div>

			<SetupCard>
				<div className={styles.step}>
					<div className={styles.labelRow}>
						<label className={styles.label} htmlFor={id}>
							{t('setup.player.select.label')}
						</label>

						<span className={styles.required}>*</span>
					</div>

					<SelectDropdown
						id={id}
						value={player}
						onChange={setPlayer}
						startIcon={<Icon name='common/play' size={16} className={styles.playIcon} />}
						options={[
							{ value: 'mpv', label: t('setup.player.select.mpv') },
							{ value: 'vlc', label: t('setup.player.select.vlc') },
							{ value: 'custom', label: t('setup.player.select.custom') }
						]}
					/>

					<p className={styles.hint}>{t('setup.player.select.hint')}</p>

					<p className={styles.install}>{t('setup.player.install')}</p>
				</div>
			</SetupCard>
		</>
	)
}
