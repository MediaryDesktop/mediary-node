import { useId, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { SelectDropdown } from '@shared/ui'

import { SetupCard } from '../layout'

import styles from './SetupDebridStep.module.scss'

export function SetupDebridStep() {
	const { t } = useTranslation()
	const id = useId()
	const [service, setService] = useState<string | null>('none')

	return (
		<SetupCard>
			<div className={styles.field}>
				<label className={styles.label} htmlFor={id}>
					{t('setup.debrid.label')}
				</label>

				<SelectDropdown
					id={id}
					value={service}
					onChange={setService}
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
