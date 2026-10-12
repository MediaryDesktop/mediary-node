import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, ListTile, ManagedList, MoreMenu, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteOPDSServerMutation, opdsServersQuery } from '@entities/manga-source'
import type { OPDSServer } from '@entities/manga-source'

import { OPDSServerDrawer } from './OPDSServerDrawer'

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

	useUnitWatch(deleteOPDSServerMutation.finished.failure, () =>
		toast.error(t('mangaSources.removeFailed'), { id: 'opds-remove-failed' })
	)

	return (
		<>
			<ManagedList
				items={data?.servers ?? []}
				emptyText={t('mangaSources.none')}
				renderItem={server => (
					<ListTile
						key={server.id}
						as='li'
						icon='common/database'
						title={server.name}
						subtitle={server.username ? `${server.username} · ${server.url}` : server.url}
						subtitleHint={server.url}
						actions={
							<MoreMenu
								label={t('mangaSources.menu')}
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
							/>
						}
					/>
				)}
				action={
					<Button
						startIcon={<Icon name='common/plus' size={16} />}
						onClick={() => setEditing(null)}
					>
						{t('mangaSources.add')}
					</Button>
				}
			/>

			<OPDSServerDrawer open={editing !== undefined} server={editing ?? null} onClose={close} />
		</>
	)
}
