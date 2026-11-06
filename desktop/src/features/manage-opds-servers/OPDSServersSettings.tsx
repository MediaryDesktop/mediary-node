import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, CollapsibleSection, EmptyCard, Icon, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteOPDSServerMutation, opdsServersQuery } from '@entities/manga-source'

import styles from './OPDSServersSettings.module.scss'
import { OPDSServerForm } from './ui/server-form/OPDSServerForm'
import { ServerRow } from './ui/server-row/ServerRow'

export function OPDSServersSettings() {
	const { t } = useTranslation()

	const [data, load, remove, removing, nodeReady] = useUnit([
		opdsServersQuery.$data,
		opdsServersQuery.start,
		deleteOPDSServerMutation.start,
		deleteOPDSServerMutation.$pending,
		$nodeReady
	])

	const [adding, setAdding] = useState(false)
	const [addKey, setAddKey] = useState(0)

	const toggleAdding = () =>
		setAdding(current => {
			if (!current) {
				setAddKey(key => key + 1)
			}
			return !current
		})

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useUnitWatch(deleteOPDSServerMutation.finished.failure, () =>
		toast.error(t('mangaSources.removeFailed'), { id: 'opds-remove-failed' })
	)

	const servers = data?.servers ?? []

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<div className={styles.headerText}>
					<h3 className={styles.title}>{t('settings.mangaSources.name')}</h3>
					<p className={styles.hint}>{t('settings.mangaSources.hint')}</p>
				</div>

				<Button
					size='small'
					iconOnly
					aria-label={adding ? t('common.cancel') : t('mangaSources.add')}
					startIcon={<Icon name={adding ? 'common/close' : 'common/plus'} size={16} />}
					onClick={toggleAdding}
				/>
			</div>

			{servers.length > 0 ? (
				<div className={styles.list}>
					{servers.map(server => (
						<ServerRow
							key={server.id}
							server={server}
							removing={removing}
							onRemove={() => remove(server.id)}
						/>
					))}
				</div>
			) : (
				<EmptyCard
					icon='common/database'
					title={t('mangaSources.none')}
					description={t('mangaSources.noneHint')}
				/>
			)}

			<CollapsibleSection open={adding}>
				<div className={styles.addSection}>
					<OPDSServerForm key={addKey} server={null} onDone={() => setAdding(false)} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
