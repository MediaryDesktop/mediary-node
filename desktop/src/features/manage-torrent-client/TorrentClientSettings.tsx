import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { torrentSettingsQuery } from '@entities/torrent'

import styles from './TorrentClient.module.scss'
import { TorrentClientDrawer } from './TorrentClientDrawer'

// The qBittorrent the node adds torrents to, and the library folder they go into.
export function TorrentClientSettings() {
	const { t } = useTranslation()

	const [settings, load, roots, loadRoots, nodeReady] = useUnit([
		torrentSettingsQuery.$data,
		torrentSettingsQuery.start,
		libraryRootsQuery.$data,
		libraryRootsQuery.start,
		$nodeReady
	])

	const [open, setOpen] = useState(false)
	const close = useCallback(() => setOpen(false), [])

	useEffect(() => {
		if (nodeReady) {
			load()
			loadRoots()
		}
	}, [load, loadRoots, nodeReady])

	if (!settings) {
		return null
	}

	const connected = settings.client !== ''
	const name =
		settings.client === 'embedded'
			? t('torrents.settings.embedded')
			: settings.client === 'qbittorrent'
				? settings.url
				: t('torrents.settings.notConfigured')
	const folder = (roots?.roots ?? []).find(root => root.id === settings.root_id)?.path

	return (
		<div className={styles.root}>
			<div className={styles.summary}>
				<span className={styles.icon}>
					<Icon name='common/download' size={18} />
				</span>

				<div className={styles.body}>
					<p className={styles.name}>{name}</p>
					{connected && (
						<p className={styles.detail} title={folder}>
							{folder ?? t('torrents.settings.folderPlaceholder')}
						</p>
					)}
				</div>

				<Button size='small' onClick={() => setOpen(true)}>
					{connected ? t('torrents.settings.edit') : t('torrents.settings.configure')}
				</Button>
			</div>

			<TorrentClientDrawer open={open} settings={settings} onClose={close} />
		</div>
	)
}
