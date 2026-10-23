import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, ListTile, ManagedList, MoreMenu, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { bookOPDSServersQuery, deleteBookOPDSServerMutation } from '@entities/book-source'
import type { BookOPDSServer } from '@entities/book-source'

import { BookServerDrawer } from '../server-drawer/BookServerDrawer'

// The user's OPDS catalogues of books, searched beside Project Gutenberg.
export function BookServersSettings() {
	const { t } = useTranslation()

	const [data, load, remove, removing, nodeReady] = useUnit([
		bookOPDSServersQuery.$data,
		bookOPDSServersQuery.start,
		deleteBookOPDSServerMutation.start,
		deleteBookOPDSServerMutation.$pending,
		$nodeReady
	])

	// undefined: closed; null: adding; a server: changing it.
	const [editing, setEditing] = useState<BookOPDSServer | null | undefined>(undefined)
	const close = useCallback(() => setEditing(undefined), [])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useUnitWatch(deleteBookOPDSServerMutation.finished.failure, () =>
		toast.error(t('bookSources.servers.removeFailed'), { id: 'book-opds-remove-failed' })
	)

	return (
		<>
			<ManagedList
				items={data?.servers ?? []}
				emptyText={t('bookSources.servers.none')}
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
								label={t('bookSources.servers.menu')}
								items={[
									{
										id: 'edit',
										label: t('bookSources.servers.edit'),
										icon: 'common/pencil',
										onSelect: () => setEditing(server)
									},
									{
										id: 'remove',
										label: t('bookSources.servers.remove'),
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
						{t('bookSources.servers.add')}
					</Button>
				}
			/>

			<BookServerDrawer open={editing !== undefined} server={editing ?? null} onClose={close} />
		</>
	)
}
