import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'

import styles from '../../ConnectAniList.module.scss'

export function GetTokenLink() {
	const { t } = useTranslation()

	const { authorizeUrl, connected, authorize } = useUnit({
		authorizeUrl: aniListAccountModel.$authorizeUrl,
		connected: aniListAccountModel.$connected,
		authorize: aniListAccountModel.authorizeRequested
	})

	if (connected) {
		return null
	}

	return (
		<button type='button' className={styles.link} disabled={!authorizeUrl} onClick={() => authorize()}>
			<Icon name='common/external-link' size={16} />
			{t('anilist.connect.open')}
		</button>
	)
}
