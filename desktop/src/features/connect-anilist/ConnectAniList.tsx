import { useUnit } from 'effector-react'
import { IoLogOutOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { aniListAccountModel } from '@entities/anilist-account'

import styles from './ConnectAniList.module.scss'
import { TokenForm } from './ui/token-form/TokenForm'

export interface ConnectAniListProps {
	showHeader?: boolean
	tokenLink?: 'inline' | 'none'
}

export function ConnectAniList({ showHeader = true, tokenLink = 'inline' }: ConnectAniListProps) {
	const { t } = useTranslation()

	const { account, connected, disconnecting, disconnect } = useUnit({
		account: aniListAccountModel.$account,
		connected: aniListAccountModel.$connected,
		disconnecting: aniListAccountModel.$disconnecting,
		disconnect: aniListAccountModel.disconnectRequested
	})

	if (!connected) {
		return <TokenForm showHeader={showHeader} tokenLink={tokenLink} />
	}

	return (
		<div className={styles.connected}>
			{account?.avatar_url ? (
				<img className={styles.avatar} src={account.avatar_url} alt='' />
			) : (
				<span className={styles.avatar}>
					<Icon name='common/user' size={18} />
				</span>
			)}

			<span className={styles.name}>
				{t('anilist.connect.connectedAs', { name: account?.name ?? 'AniList' })}
			</span>

			<Button
				variant='glass-accent'
				startIcon={<IoLogOutOutline size={22} />}
				loading={disconnecting}
				onClick={() => disconnect()}
			>
				{t('anilist.connect.disconnect')}
			</Button>
		</div>
	)
}
