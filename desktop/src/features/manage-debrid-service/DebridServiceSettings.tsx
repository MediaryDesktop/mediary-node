import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { LoadFailed } from '@shared/ui'

import { useNodeQuery } from '@infra/node'

import { torrentDebridQuery } from '@entities/torrent'

import styles from './DebridServiceSettings.module.scss'
import { DebridServiceForm } from './ui/service-form/DebridServiceForm'

export function DebridServiceSettings() {
	const { t } = useTranslation()

	const { phase, data: debrid, retry } = useNodeQuery(torrentDebridQuery)

	const [formKey, setFormKey] = useState(0)
	const reset = useCallback(() => setFormKey(key => key + 1), [])

	if (phase === 'loading') {
		return null
	}

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.debrid.name')}</h3>
				<p className={styles.hint}>{t('settings.debrid.hint')}</p>
			</div>

			{debrid ? (
				<DebridServiceForm key={formKey} debrid={debrid} onReset={reset} />
			) : (
				<LoadFailed onRetry={retry} />
			)}
		</div>
	)
}
