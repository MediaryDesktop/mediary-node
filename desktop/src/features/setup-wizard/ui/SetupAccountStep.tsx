import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import styles from './SetupAccountStep.module.scss'
import { SetupCard } from './SetupCard'

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

				<Button variant='secondary' fullWidth startIcon={<Icon name='common/mail' size={18} />}>
					{t('setup.account.email')}
				</Button>

				<button type='button' className={styles.skip}>
					{t('setup.account.skip')}
				</button>
			</div>
		</SetupCard>
	)
}
