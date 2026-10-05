import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, toast } from '@shared/ui'

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
						<li key={server.id} className={styles.server}>
							<span className={styles.icon}>
								<Icon name='common/database' size={18} />
							</span>

							<div className={styles.body}>
								<p className={styles.name}>{server.name}</p>
								<p className={styles.url} title={server.url}>
									{server.username ? `${server.username} · ${server.url}` : server.url}
								</p>
							</div>

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
									<button
										type='button'
										className={styles.action}
										aria-label={t('mangaSources.menu')}
									>
										<Icon name='common/more-vertical' size={16} />
									</button>
								}
							/>
						</li>
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
