import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { SetupCard } from '../layout'

import styles from './SetupAccountStep.module.scss'

export function SetupAccountStep() {
	const { t } = useTranslation()

	return (
		<SetupCard>
			<div className={styles.step}>
				<p className={styles.blurb}>{t('setup.account.blurb')}</p>

				<Button variant='glass' fullWidth startIcon={<Icon name='social/google' size={20} />}>
					{t('setup.account.google')}
				</Button>

				<div className={styles.divider}>{t('setup.account.or')}</div>

				<Button variant='ghost' fullWidth startIcon={<Icon name='common/mail' size={18} />}>
					{t('setup.account.email')}
				</Button>
			</div>
		</SetupCard>
	)
}
