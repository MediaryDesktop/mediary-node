import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, ListTile } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { libraryRootsQuery } from '@entities/library-item'
import { torrentSettingsQuery } from '@entities/torrent'

import styles from './TorrentClientSettings.module.scss'
import { TorrentClientDrawer } from './ui/client-drawer/TorrentClientDrawer'

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
			<ListTile
				icon='common/download'
				title={name}
				subtitle={connected ? (folder ?? t('torrents.settings.folderPlaceholder')) : undefined}
				subtitleHint={folder}
				actions={
					<Button size='small' onClick={() => setOpen(true)}>
						{connected ? t('torrents.settings.edit') : t('torrents.settings.configure')}
					</Button>
				}
			/>

			<TorrentClientDrawer open={open} settings={settings} onClose={close} />
		</div>
	)
}
