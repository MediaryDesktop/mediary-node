import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { sessionModel } from '@entities/session'

import { accountDeletionOpened, DeleteAccountDialog } from '@features/auth'

import styles from './DeleteAccountCard.module.scss'

export function DeleteAccountCard() {
	const { t } = useTranslation()
	const account = useUnit(sessionModel.$account)

	if (!account) {
		return null
	}

	return (
		<section className={styles.card}>
			<div className={styles.text}>
				<h3 className={styles.title}>{t('settings.deleteAccount.title')}</h3>
				<p className={styles.hint}>{t('settings.deleteAccount.hint')}</p>
			</div>

			<Button
				variant='glass-accent'
				fullWidth
				className={styles.button}
				startIcon={<Icon name='common/trash' size={18} />}
				onClick={() => accountDeletionOpened()}
			>
				{t('settings.deleteAccount.action')}
			</Button>

			<DeleteAccountDialog />
		</section>
	)
}
