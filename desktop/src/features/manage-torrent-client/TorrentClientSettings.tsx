import { useUnit } from 'effector-react'
import { useEffect, useRef } from 'react'

import { useTranslation } from '@shared/i18n'
import { LoadFailed } from '@shared/ui'

import { useNodeData, useNodeQuery } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { torrentDebridQuery, torrentSettingsQuery } from '@entities/torrent'

import { clientForm } from './model/form'
import styles from './TorrentClientSettings.module.scss'
import { TorrentClientForm } from './ui/client-form/TorrentClientForm'

export function TorrentClientSettings() {
	const { t } = useTranslation()

	const settingsState = useNodeQuery(torrentSettingsQuery)
	const [opened, settings, fields] = useUnit([clientForm.opened, clientForm.$settings, clientForm.$fields])

	useNodeData(libraryRootsQuery)
	useNodeData(torrentDebridQuery)

	const loaded = settingsState.data
	const openedOnce = useRef(false)

	useEffect(() => {
		if (loaded && !openedOnce.current) {
			openedOnce.current = true
			opened(loaded)
		}
	}, [loaded, opened])

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.torrents.name')}</h3>
				<p className={styles.hint}>{t('settings.torrents.hint')}</p>
			</div>

			{settingsState.phase === 'failed' ? (
				<LoadFailed onRetry={settingsState.retry} />
			) : (
				settings && fields && <TorrentClientForm settings={settings} fields={fields} />
			)}
		</div>
	)
}
