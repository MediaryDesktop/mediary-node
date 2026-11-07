import { useUnit } from 'effector-react'
import { useCallback, useState } from 'react'

import { useTranslation } from '@shared/i18n'

import { useNodeData } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { torrentDebridQuery, torrentSettingsQuery } from '@entities/torrent'

import styles from './TorrentClientSettings.module.scss'
import { TorrentClientForm } from './ui/client-form/TorrentClientForm'

export function TorrentClientSettings() {
	const { t } = useTranslation()

	const [settings] = useUnit([torrentSettingsQuery.$data])

	const [formKey, setFormKey] = useState(0)
	const reset = useCallback(() => setFormKey(key => key + 1), [])

	useNodeData(torrentSettingsQuery)
	useNodeData(libraryRootsQuery)
	useNodeData(torrentDebridQuery)

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
