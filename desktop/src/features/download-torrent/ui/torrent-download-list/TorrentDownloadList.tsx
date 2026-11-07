import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { EmptyState, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

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
	mediaRef?: string
	title?: string
	poster?: string | null
}

export function TorrentDownloadList({ mediaRef, title, poster }: TorrentDownloadListProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [data, pause, resume, remove, filesFor, requestFiles, dismissFiles, previews, requestPreview] =
		useUnit([
			torrentDownloadsQuery.$data,
			pauseTorrentMutation.start,
			resumeTorrentMutation.start,
			removeTorrentMutation.start,
			$filesFor,
			filesRequested,
			filesDismissed,
			mediaPreviewModel.$previews,
			mediaPreviewModel.previewRequested
		])

	useNodeData(torrentDownloadsQuery)

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('torrents.actionFailed')), { id: 'torrent-action' })

	useUnitWatch(pauseTorrentMutation.finished.failure, failed)
	useUnitWatch(resumeTorrentMutation.finished.failure, failed)
	useUnitWatch(removeTorrentMutation.finished.failure, failed)

	const downloads = (data?.downloads ?? []).filter(item => !mediaRef || item.media_ref === mediaRef)

	useEffect(() => {
		if (poster !== undefined) return

		for (const ref of new Set(downloads.map(item => item.media_ref))) {
			requestPreview(ref)
		}
	}, [poster, requestPreview, downloads])

	const choosing = downloads.find(item => item.id === filesFor) ?? null

	const states = downloads.map(displayState)
	const active = states.filter(state => state !== 'done' && state !== 'failed').length
	const inLibrary = states.filter(state => state === 'done').length

	return (
		<section className={styles.root}>
			<TorrentSetupNotice
				setup={setup}
				onOpenSettings={() =>
					navigate({
						to: '/settings',
						search: { section: 'torrents' }
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
