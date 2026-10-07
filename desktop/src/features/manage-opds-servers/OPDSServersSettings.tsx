import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, ListTile, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteOPDSServerMutation, opdsServersQuery } from '@entities/manga-source'
import type { OPDSServer } from '@entities/manga-source'

import { OPDSServerDrawer } from './OPDSServerDrawer'
import styles from './OPDSServers.module.scss'

export function OPDSServersSettings() {
	const { t } = useTranslation()

	const [data, load, remove, removing, nodeReady] = useUnit([
		opdsServersQuery.$data,
		opdsServersQuery.start,
		deleteOPDSServerMutation.start,
		deleteOPDSServerMutation.$pending,
		$nodeReady
	])

	// undefined: closed; null: adding; a server: changing it.
	const [editing, setEditing] = useState<OPDSServer | null | undefined>(undefined)
	const close = useCallback(() => setEditing(undefined), [])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useEffect(
		() =>
			deleteOPDSServerMutation.finished.failure.watch(() =>
				toast.error(t('mangaSources.removeFailed'), { id: 'opds-remove-failed' })
			),
		[t]
	)

	const servers = data?.servers ?? []

	return (
		<div className={styles.root}>
			{servers.length === 0 ? (
				<p className={styles.empty}>{t('mangaSources.none')}</p>
			) : (
				<ul className={styles.servers}>
					{servers.map(server => (
						<ListTile
							key={server.id}
							as='li'
							icon='common/database'
							title={server.name}
							subtitle={server.username ? `${server.username} · ${server.url}` : server.url}
							subtitleHint={server.url}
							actions={
								<DropdownMenu
									items={[
										{
											id: 'edit',
											label: t('mangaSources.edit'),
											icon: 'common/pencil',
											onSelect: () => setEditing(server)
										},
										{
											id: 'remove',
											label: t('mangaSources.remove'),
											icon: 'common/trash',
											danger: true,
											disabled: removing,
											onSelect: () => remove(server.id)
										}
									]}
									trigger={
										<Button
											size='small'
											variant='ghost'
											iconOnly
											aria-label={t('mangaSources.menu')}
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
				{t('mangaSources.add')}
			</Button>

			<OPDSServerDrawer open={editing !== undefined} server={editing ?? null} onClose={close} />
		</div>
	)
}
