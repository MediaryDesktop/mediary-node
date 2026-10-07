import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, ListTile, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteTorrentSourceMutation, torrentSourcesQuery } from '@entities/torrent'
import type { TorrentSource } from '@entities/torrent'

import { TorznabSourceDrawer } from './TorznabSourceDrawer'
import styles from './TorznabSources.module.scss'

// The user's Jackett or Prowlarr endpoints the node searches for releases.
export function TorznabSourcesSettings() {
	const { t } = useTranslation()

	const [data, load, remove, removing, nodeReady] = useUnit([
		torrentSourcesQuery.$data,
		torrentSourcesQuery.start,
		deleteTorrentSourceMutation.start,
		deleteTorrentSourceMutation.$pending,
		$nodeReady
	])

	// undefined: closed; null: adding; a source: changing it.
	const [editing, setEditing] = useState<TorrentSource | null | undefined>(undefined)
	const close = useCallback(() => setEditing(undefined), [])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useEffect(
		() =>
			deleteTorrentSourceMutation.finished.failure.watch(() =>
				toast.error(t('torrents.sources.removeFailed'), { id: 'torznab-remove-failed' })
			),
		[t]
	)

	const sources = data?.sources ?? []

	return (
		<div className={styles.root}>
			{sources.length === 0 ? (
				<p className={styles.empty}>{t('torrents.sources.none')}</p>
			) : (
				<ul className={styles.servers}>
					{sources.map(source => (
						<ListTile
							key={source.id}
							as='li'
							icon='common/search'
							title={source.name}
							subtitle={source.url}
							subtitleHint={source.url}
							actions={
								<DropdownMenu
									items={[
										{
											id: 'edit',
											label: t('torrents.sources.edit'),
											icon: 'common/pencil',
											onSelect: () => setEditing(source)
										},
										{
											id: 'remove',
											label: t('torrents.sources.remove'),
											icon: 'common/trash',
											danger: true,
											disabled: removing,
											onSelect: () => remove(source.id)
										}
									]}
									trigger={
										<Button
											size='small'
											variant='ghost'
											iconOnly
											aria-label={t('torrents.sources.menu')}
											startIcon={<Icon name='common/more-vertical' size={16} />}
										/>
									}
								/>
							}
						/>
					))}
				</ul>
			)}

			<Button startIcon={<Icon name='common/plus' size={16} />} onClick={() => setEditing(null)}>
				{t('torrents.sources.add')}
			</Button>

			<TorznabSourceDrawer open={editing !== undefined} source={editing ?? null} onClose={close} />
		</div>
	)
}
