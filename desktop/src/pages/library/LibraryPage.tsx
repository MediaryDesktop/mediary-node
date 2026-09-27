import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import {
	Button,
	EmptyState,
	Icon,
	Input,
	PageHeader,
	PageTransition,
	SegmentedControl,
	toast
} from '@shared/ui'

import {
	LIBRARY_PAGE_SIZE,
	libraryFilesQuery,
	libraryModel,
	libraryRootsQuery,
	libraryScanQuery
} from '@entities/library-item'
import { playbackModel } from '@entities/playback'

import { MatchFileDrawer, matchFileModel } from '@features/match-library-file'

import { LIBRARY_VIEWS, visibleFiles } from './lib/library-view'
import type { LibraryView } from './lib/library-view'
import { LibraryFiles } from './library-files/LibraryFiles'
import { LibraryRoots } from './library-roots/LibraryRoots'
import styles from './LibraryPage.module.scss'
import { ScanPanel } from './scan-panel/ScanPanel'

export function LibraryPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [roots, rootsPending, startRoots] = useUnit([
		libraryRootsQuery.$data,
		libraryRootsQuery.$pending,
		libraryRootsQuery.start
	])

	const [page, filesPending, filesError, startFiles] = useUnit([
		libraryFilesQuery.$data,
		libraryFilesQuery.$pending,
		libraryFilesQuery.$error,
		libraryFilesQuery.start
	])

	const [scan, startScanStatus] = useUnit([libraryScanQuery.$data, libraryScanQuery.start])

	const [activity, pickingFolder, folderRequested, scanRequested] = useUnit([
		libraryModel.$activity,
		libraryModel.$pickingFolder,
		libraryModel.folderRequested,
		libraryModel.scanRequested
	])

	const matchRequested = useUnit(matchFileModel.requested)

	const [playing, playRequested] = useUnit([playbackModel.$session, playbackModel.playRequested])

	const [view, setView] = useState<LibraryView>('all')
	const [search, setSearch] = useState('')

	useEffect(() => {
		startRoots()
		startFiles()
		startScanStatus()
	}, [startRoots, startFiles, startScanStatus])

	useEffect(() => {
		const stop = [
			libraryModel.rootAddFailed.watch(({ error }) =>
				toast.error(
					error.status === 409
						? (error.body?.detail ?? t('library.root.overlap'))
						: (error.body?.detail ?? t('library.root.failed')),
					{ id: 'library-root-failed' }
				)
			),
			libraryModel.rootDeleteFailed.watch(() =>
				toast.error(t('library.root.removeFailed'), { id: 'library-root-remove-failed' })
			),

			// The node says why it cannot play a file — mpv missing, the file gone —
			// and that sentence is more useful than anything this page could invent.
			playbackModel.playFailed.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('playback.failed'), { id: 'playback-failed' })
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	const allRoots = useMemo(() => roots?.roots ?? [], [roots])
	const files = useMemo(() => page?.files.items ?? [], [page])

	const visible = useMemo(() => visibleFiles(files, view, search), [files, view, search])

	// The counts come from the node rather than from the page: the tabs say how
	// much there is to page through, and a page holds at most LIBRARY_PAGE_SIZE.
	const counts = page?.files.counts
	const total = page?.files.total ?? 0
	const scanning = activity !== null || (scan?.scan.running ?? false)

	if (!rootsPending && allRoots.length === 0) {
		return (
			<PageTransition className={styles.root}>
				<PageHeader
					title={t('nav.library')}
					icon={<Icon name='common/database' size={24} />}
					subtitle={t('library.description')}
				/>

				<EmptyState
					size='page'
					title={t('library.empty.title')}
					description={t('library.empty.description')}
					action={
						<Button
							variant='primary'
							startIcon={<Icon name='common/folder-open' size={16} />}
							disabled={pickingFolder}
							onClick={() => folderRequested()}
						>
							{t('library.root.add')}
						</Button>
					}
				/>
			</PageTransition>
		)
	}

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.library')}
				icon={<Icon name='common/database' size={24} />}
				subtitle={t('library.description')}
				rightContent={
					<div className={styles.actions}>
						<Button
							variant='primary'
							startIcon={<Icon name='common/folder-open' size={16} />}
							disabled={pickingFolder}
							onClick={() => folderRequested()}
						>
							{t('library.root.add')}
						</Button>

						<Button
							startIcon={<Icon name='common/reset' size={16} />}
							disabled={scanning}
							onClick={() => scanRequested(0)}
						>
							{scanning ? t('library.scan.running') : t('library.scan.start')}
						</Button>

						<Button
							startIcon={<Icon name='common/clock' size={16} />}
							onClick={() => navigate({ to: '/library/history' })}
						>
							{t('library.history.action')}
						</Button>
					</div>
				}
			/>

			<ScanPanel
				activity={activity}
				scan={scan?.scan ?? null}
				total={counts?.total ?? total}
				unmatched={counts?.unmatched ?? 0}
			/>

			<LibraryRoots roots={allRoots} scanning={scanning} />

			<section className={styles.files}>
				<div className={styles.toolbar}>
					<Input
						value={search}
						onChange={event => setSearch(event.target.value)}
						placeholder={t('library.search')}
						startIcon={<Icon name='common/search' size={16} />}
						className={styles.search}
					/>

					<SegmentedControl
						size='large'
						items={LIBRARY_VIEWS.map(mode => ({
							value: mode,
							label: (
								<span className={styles.filter}>
									{t(`library.view.${mode}`)}
									<span className={styles.count}>({filterCount(mode, counts, total)})</span>
								</span>
							)
						}))}
						value={view}
						onValueChange={setView}
					/>
				</div>

				{filesError && files.length === 0 && (
					<EmptyState
						title={t('library.failed')}
						action={
							<Button size='small' onClick={() => startFiles()}>
								{t('library.retry')}
							</Button>
						}
					/>
				)}

				{filesPending && files.length === 0 && <p className={styles.muted}>{t('library.loading')}</p>}

				{visible.length > 0 && (
					<LibraryFiles
						files={visible}
						titles={page?.files.titles ?? undefined}
						playingFileID={playing?.file_id}
						onPlay={file => playRequested(file.id)}
						onMatch={file => matchRequested(file)}
					/>
				)}

				{!filesPending && !filesError && visible.length === 0 && (
					<EmptyState
						title={files.length === 0 ? t('library.noFiles') : t('library.noMatches')}
						description={files.length === 0 ? t('library.noFilesHint') : undefined}
					/>
				)}

				{total > files.length && (
					<p className={styles.muted}>
						{t('library.truncated', { shown: LIBRARY_PAGE_SIZE, total })}
					</p>
				)}
			</section>

			<MatchFileDrawer />
		</PageTransition>
	)
}

function filterCount(
	view: LibraryView,
	counts: { total: number; unmatched: number; missing: number } | undefined,
	total: number
): number {
	if (!counts) {
		return view === 'all' ? total : 0
	}

	return counts[view === 'all' ? 'total' : view]
}
