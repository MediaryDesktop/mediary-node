import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import { $nodeReady } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { torrentDebridQuery, torrentSettingsQuery } from '@entities/torrent'

import styles from './TorrentClientSettings.module.scss'
import { TorrentClientForm } from './ui/client-form/TorrentClientForm'

// The client the node adds torrents to, and the library folder they go into.
export function TorrentClientSettings() {
	const { t } = useTranslation()

	const [settings, load, loadRoots, loadDebrid, nodeReady] = useUnit([
		torrentSettingsQuery.$data,
		torrentSettingsQuery.start,
		libraryRootsQuery.start,
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
			loadRoots()
			loadDebrid()
		}
	}, [load, loadRoots, loadDebrid, nodeReady])

	if (!settings) {
		return null
	}

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.torrents.name')}</h3>
				<p className={styles.hint}>{t('settings.torrents.hint')}</p>
			</div>

			<TorrentClientForm key={formKey} settings={settings} onReset={reset} />
		</div>
	)
}
