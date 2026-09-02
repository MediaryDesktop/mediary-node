import { useId } from 'react'

import { useTranslation } from '@shared/i18n'
import { Select } from '@shared/ui'

import { SetupCard } from './SetupCard'
import styles from './SetupDebridStep.module.scss'

export function SetupDebridStep() {
	const { t } = useTranslation()
	const id = useId()

	return (
		<SetupCard>
			<div className={styles.field}>
				<label className={styles.label} htmlFor={id}>
					{t('setup.debrid.label')}
				</label>

				<Select
					id={id}
					defaultValue='none'
					options={[
						{ value: 'none', label: t('setup.debrid.none') },
						{ value: 'torbox', label: t('setup.debrid.torbox') },
						{ value: 'real-debrid', label: t('setup.debrid.realDebrid') },
						{ value: 'alldebrid', label: t('setup.debrid.allDebrid') },
						{ value: 'premiumize', label: t('setup.debrid.premiumize') }
					]}
				/>
			</div>
		</SetupCard>
	)
}
