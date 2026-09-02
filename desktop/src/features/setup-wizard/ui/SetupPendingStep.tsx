import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import styles from './SetupPendingStep.module.scss'

export function SetupPendingStep() {
	const { t } = useTranslation()

	return (
		<div className={styles.pending}>
			<Icon name='common/sparkles' size={22} />
			<p className={styles.text}>{t('setup.pending')}</p>
		</div>
	)
}
