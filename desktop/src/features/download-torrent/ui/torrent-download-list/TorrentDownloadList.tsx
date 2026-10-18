import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { EmptyState, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { mediaPreviewModel } from '@entities/media'
import {
	pauseTorrentMutation,
	removeTorrentMutation,
	resumeTorrentMutation,
	torrentDownloadsQuery,
	TorrentSetupNotice,
	useTorrentSetup
} from '@entities/torrent'

import { displayState } from '../../lib/display-state'
import { $filesFor, filesDismissed, filesRequested } from '../../model/model'

import { DownloadRow } from './download-row/DownloadRow'
import { DownloadSummary } from './download-summary/DownloadSummary'
import { TorrentFilesDrawer } from './files-drawer/TorrentFilesDrawer'
import { TorrentQuickAdd } from './quick-add/TorrentQuickAdd'
import styles from './TorrentDownloadList.module.scss'

export interface TorrentDownloadListProps {
	// Only this title's downloads; all of them, with a summary, when left out.
	mediaRef?: string
	// The title's name; needed only alongside mediaRef, to label a quick add.
	title?: string
	poster?: string | null
}

// Torrents the node added to its client, newest first. The node polls the client
// and announces each change, so the list moves while a torrent downloads.
export function TorrentDownloadList({ mediaRef, title, poster }: TorrentDownloadListProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [
		data,
		load,
		pause,
		resume,
		remove,
		nodeReady,
		filesFor,
		requestFiles,
		dismissFiles,
		previews,
		requestPreview
	] = useUnit([
		torrentDownloadsQuery.$data,
		torrentDownloadsQuery.start,
		pauseTorrentMutation.start,
		resumeTorrentMutation.start,
		removeTorrentMutation.start,
		$nodeReady,
		$filesFor,
		filesRequested,
		filesDismissed,
		mediaPreviewModel.$previews,
		mediaPreviewModel.previewRequested
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('torrents.actionFailed')), { id: 'torrent-action' })

	useUnitWatch(pauseTorrentMutation.finished.failure, failed)
	useUnitWatch(resumeTorrentMutation.finished.failure, failed)
	useUnitWatch(removeTorrentMutation.finished.failure, failed)

	const downloads = (data?.downloads ?? []).filter(item => !mediaRef || item.media_ref === mediaRef)

	// The caller already has the poster when it scopes the list to one title; for
	// the all-titles list every row needs its own, fetched (and cached) by ref.
	useEffect(() => {
		if (poster !== undefined) return

		for (const ref of new Set(downloads.map(item => item.media_ref))) {
			requestPreview(ref)
		}
	}, [poster, requestPreview, downloads])

	// Only the list that shows the download hosts the choice, so a page with two
	// lists does not open it twice.
	const choosing = downloads.find(item => item.id === filesFor) ?? null

	const states = downloads.map(displayState)
	const active = states.filter(state => state !== 'done' && state !== 'failed').length
	const inLibrary = states.filter(state => state === 'done').length

	return (
		<section className={styles.root}>
			<TorrentSetupNotice
				setup={setup}
				onOpenSettings={missing =>
					navigate({
						to: '/settings',
						search: { section: missing === 'client' ? 'torrent-client' : 'torrent-search' }
					})
				}
			/>

			{mediaRef && <h3 className={styles.subtitle}>{t('torrents.list.forTitle')}</h3>}

			{!mediaRef && downloads.length > 0 && (
				<DownloadSummary active={active} inLibrary={inLibrary} setup={setup} />
			)}

			{downloads.length === 0 ? (
				mediaRef && title ? (
					<TorrentQuickAdd mediaRef={mediaRef} title={title} />
				) : (
					<EmptyState
						title={mediaRef ? t('torrents.list.emptyForTitle') : t('torrents.list.empty')}
						description={
							mediaRef ? t('torrents.list.emptyForTitleHint') : t('torrents.list.emptyHint')
						}
					/>
				)
			) : (
				<ul className={styles.list}>
					{downloads.map(item => (
						<DownloadRow
							key={item.id}
							item={item}
							showTitle={!mediaRef}
							poster={poster ?? previews[item.media_ref]?.cover_image}
							onPause={() => pause(item.id)}
							onResume={() => resume(item.id)}
							onRemove={withFiles => remove({ id: item.id, withFiles })}
							onChooseFiles={() => requestFiles(item.id)}
						/>
					))}
				</ul>
			)}

			<TorrentFilesDrawer download={choosing} onClose={dismissFiles} />
		</section>
	)
}
