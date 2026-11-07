import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, CollapsibleSection, EmptyCard, Icon, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { deleteTorrentSourceMutation, torrentSourcesQuery } from '@entities/torrent'

import { sourceEditor } from '../../model/editor'

import { TorznabSourceForm } from './source-form/TorznabSourceForm'
import { SourceRow } from './source-row/SourceRow'
import styles from './TorznabSourcesSettings.module.scss'

export function TorznabSourcesSettings() {
	const { t } = useTranslation()

	const [data, remove, removing] = useUnit([
		torrentSourcesQuery.$data,
		deleteTorrentSourceMutation.start,
		deleteTorrentSourceMutation.$pending
	])

	const [editing, opened, closed] = useUnit([
		sourceEditor.$editing,
		sourceEditor.opened,
		sourceEditor.closed
	])

	const adding = editing !== null && editing.item === null
	const toggleAdding = () => (adding ? closed() : opened(null))

	useNodeData(torrentSourcesQuery)

	useUnitWatch(deleteTorrentSourceMutation.finished.failure, () =>
		toast.error(t('torrents.sources.removeFailed'), { id: 'torznab-remove-failed' })
	)
	useUnitWatch(sourceEditor.saveFailed, error =>
		toast.error(problemDetail(error, t('torrents.sources.saveFailed')), { id: 'torznab-save-failed' })
	)

	const sources = data?.sources ?? []

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<div className={styles.headerText}>
					<h3 className={styles.title}>{t('settings.torrentSearch.name')}</h3>
					<p className={styles.hint}>{t('settings.torrentSearch.hint')}</p>
				</div>

				<Button
					size='small'
					iconOnly
					aria-label={adding ? t('common.cancel') : t('torrents.sources.add')}
					startIcon={<Icon name={adding ? 'common/close' : 'common/plus'} size={16} />}
					onClick={toggleAdding}
				/>
			</div>

			{sources.length > 0 ? (
				<div className={styles.list}>
					{sources.map(source => (
						<SourceRow
							key={source.id}
							source={source}
							removing={removing}
							onRemove={() => remove(source.id)}
						/>
					))}
				</div>
			) : (
				<EmptyCard
					icon='common/search'
					title={t('torrents.sources.none')}
					description={t('torrents.sources.noneHint')}
				/>
			)}

			<CollapsibleSection open={adding}>
				<div className={styles.addSection}>
					<TorznabSourceForm />
				</div>
			</CollapsibleSection>
		</div>
	)
}
