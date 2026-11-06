import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'

import { aniListAccountModel } from '@entities/anilist-account'

import { ConnectAniList, GetTokenLink } from '../../ConnectAniList'

import styles from './AniListAccountSettings.module.scss'

export function AniListAccountSettings() {
	const { t } = useTranslation()
	const connected = useUnit(aniListAccountModel.$connected)

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.anilist.name')}</h3>
				<p className={styles.hint}>{t('settings.anilist.hint')}</p>
			</div>

			<ConnectAniList showHeader={false} tokenLink='none' />

			{!connected && <GetTokenLink />}
		</div>
	)
}
