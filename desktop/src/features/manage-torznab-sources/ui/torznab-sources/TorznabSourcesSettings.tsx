import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, CollapsibleSection, Icon, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteTorrentSourceMutation, torrentSourcesQuery } from '@entities/torrent'

import { TorznabSourceForm } from './source-form/TorznabSourceForm'
import { SourceRow } from './source-row/SourceRow'
import styles from './TorznabSourcesSettings.module.scss'

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

	// Shut by default. The form stays mounted through the closing animation
	// (CollapsibleSection only hides it); addKey remounts it with fresh,
	// empty fields each time it opens, so a cancelled draft never lingers.
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

	useUnitWatch(deleteTorrentSourceMutation.finished.failure, () =>
		toast.error(t('torrents.sources.removeFailed'), { id: 'torznab-remove-failed' })
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
				<p className={styles.empty}>{t('torrents.sources.none')}</p>
			)}

			<CollapsibleSection open={adding}>
				<div className={styles.addSection}>
					<TorznabSourceForm key={addKey} source={null} onDone={() => setAdding(false)} />
				</div>
			</CollapsibleSection>
		</div>
	)
}
