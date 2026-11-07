import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, CollapsibleSection, EmptyCard, Icon, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { bookOPDSServersQuery, deleteBookOPDSServerMutation } from '@entities/book-source'

import { BookServerForm } from '../server-form/BookServerForm'
import { BookServerRow } from '../server-row/BookServerRow'

import styles from './BookServersSettings.module.scss'

export function BookServersSettings() {
	const { t } = useTranslation()

	const [data, remove, removing] = useUnit([
		bookOPDSServersQuery.$data,
		deleteBookOPDSServerMutation.start,
		deleteBookOPDSServerMutation.$pending
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

	useNodeData(bookOPDSServersQuery)

	useUnitWatch(deleteBookOPDSServerMutation.finished.failure, () =>
		toast.error(t('bookSources.servers.removeFailed'), { id: 'book-opds-remove-failed' })
	)

	const servers = data?.servers ?? []

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<div className={styles.headerText}>
					<h3 className={styles.title}>{t('settings.bookServers.name')}</h3>
					<p className={styles.hint}>{t('settings.bookServers.hint')}</p>
				</div>

				<Button
					size='small'
					iconOnly
					aria-label={adding ? t('common.cancel') : t('bookSources.servers.add')}
					startIcon={<Icon name={adding ? 'common/close' : 'common/plus'} size={16} />}
					onClick={toggleAdding}
				/>
			</div>

			{servers.length > 0 ? (
				<div className={styles.list}>
					{servers.map(server => (
						<BookServerRow
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
					title={t('bookSources.servers.none')}
					description={t('bookSources.servers.noneHint')}
				/>
			)}

			<CollapsibleSection open={adding}>
				<div className={styles.addSection}>
					<BookServerForm key={addKey} server={null} onDone={() => setAdding(false)} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
