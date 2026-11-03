import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, CollapsibleSection, Icon, ListTile, ManagedList, MoreMenu, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteTorrentSourceMutation, torrentSourcesQuery } from '@entities/torrent'
import type { TorrentSource } from '@entities/torrent'

import styles from './TorznabSourcesSettings.module.scss'
import { TorznabSourceForm } from './source-form/TorznabSourceForm'

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

	// undefined: nothing open; null: the add form is open; a source: that row's
	// edit form is open.
	const [editing, setEditing] = useState<TorrentSource | null | undefined>(undefined)
	const close = useCallback(() => setEditing(undefined), [])
	const adding = editing === null

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useUnitWatch(deleteTorrentSourceMutation.finished.failure, () =>
		toast.error(t('torrents.sources.removeFailed'), { id: 'torznab-remove-failed' })
	)

	return (
		<div className={styles.root}>
			<ManagedList
				items={data?.sources ?? []}
				emptyText={t('torrents.sources.none')}
				renderItem={source => {
					const open = editing != null && editing.id === source.id

					return (
						<li key={source.id} className={styles.item}>
							<ListTile
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
												label: open ? t('common.cancel') : t('torrents.sources.edit'),
												icon: open ? 'common/close' : 'common/pencil',
												onSelect: () => setEditing(open ? undefined : source)
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

							<CollapsibleSection open={open}>
								{open && (
									<div className={styles.form}>
										<TorznabSourceForm source={source} onDone={close} />
									</div>
								)}
							</CollapsibleSection>
						</li>
					)
				}}
				action={
					<Button
						startIcon={<Icon name={adding ? 'common/close' : 'common/plus'} size={16} />}
						onClick={() => setEditing(adding ? undefined : null)}
					>
						{adding ? t('common.cancel') : t('torrents.sources.add')}
					</Button>
				}
			/>

			<CollapsibleSection open={adding} className={styles.addForm}>
				{adding && (
					<div className={styles.form}>
						<TorznabSourceForm source={null} onDone={close} />
					</div>
				)}
			</CollapsibleSection>
		</div>
	)
}
