import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import { $nodeReady } from '@infra/node'

import { torrentDebridQuery } from '@entities/torrent'

import styles from './DebridServiceSettings.module.scss'
import { DebridServiceForm } from './ui/service-form/DebridServiceForm'

// The debrid service: set up apart from the torrent client, it plays torrents
// without downloading them and marks the releases it holds, whatever the client.
export function DebridServiceSettings() {
	const { t } = useTranslation()

	const [debrid, load, nodeReady] = useUnit([
		torrentDebridQuery.$data,
		torrentDebridQuery.start,
		$nodeReady
	])

	// Bumped after a save or a cancel, so the form below remounts with fresh
	// fields instead of carrying over whatever was half-typed.
	const [formKey, setFormKey] = useState(0)
	const reset = useCallback(() => setFormKey(key => key + 1), [])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	if (!debrid) {
		return null
	}

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.debrid.name')}</h3>
				<p className={styles.hint}>{t('settings.debrid.hint')}</p>
			</div>

			<DebridServiceForm key={formKey} debrid={debrid} onReset={reset} />
		</div>
	)
}
