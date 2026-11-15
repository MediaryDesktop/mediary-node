import { useUnit } from 'effector-react'
import { IoLogOutOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { sessionModel } from '@entities/session'

import styles from './AccountCard.module.scss'

export function AccountCard() {
	const { t } = useTranslation()

	const [account, signOutPending, signOut] = useUnit([
		sessionModel.$account,
		sessionModel.$signOutPending,
		sessionModel.signOutRequested
	])

	if (!account) {
		return null
	}

	return (
		<div className={styles.card}>
			<span className={styles.avatar}>
				<Icon name='common/user' size={20} />
			</span>

			<div className={styles.body}>
				<h3 className={styles.title}>{t('settings.account.name')}</h3>
				<p className={styles.hint}>{t('settings.account.hint', { email: account.email })}</p>
			</div>

			<Button
				variant='glass-accent'
				startIcon={<IoLogOutOutline size={22} />}
				loading={signOutPending}
				onClick={() => signOut()}
			>
				{t('settings.account.signOut')}
			</Button>
		</div>
	)
}
