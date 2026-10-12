import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, ListTile, ManagedList, MoreMenu, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteTorrentSourceMutation, torrentSourcesQuery } from '@entities/torrent'
import type { TorrentSource } from '@entities/torrent'

import { TorznabSourceDrawer } from './TorznabSourceDrawer'

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

	useUnitWatch(deleteTorrentSourceMutation.finished.failure, () =>
		toast.error(t('torrents.sources.removeFailed'), { id: 'torznab-remove-failed' })
	)

	return (
		<>
			<ManagedList
				items={data?.sources ?? []}
				emptyText={t('torrents.sources.none')}
				renderItem={source => (
					<ListTile
						key={source.id}
						as='li'
						icon='common/search'
						title={source.name}
						subtitle={source.url}
						subtitleHint={source.url}
						actions={
							<MoreMenu
								label={t('torrents.sources.menu')}
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
							/>
						}
					/>
				)}
				action={
					<Button
						startIcon={<Icon name='common/plus' size={16} />}
						onClick={() => setEditing(null)}
					>
						{t('torrents.sources.add')}
					</Button>
				}
			/>

			<TorznabSourceDrawer open={editing !== undefined} source={editing ?? null} onClose={close} />
		</>
	)
}
