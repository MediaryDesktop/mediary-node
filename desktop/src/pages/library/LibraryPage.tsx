import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { LuFolderSync } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, Icon, PageHeader, PageTransition, PhaseTransition } from '@shared/ui'

import { libraryCollectionQuery, libraryRootsQuery, libraryScanQuery } from '@entities/library-item'

import { LibraryExplorer } from '@features/library-explorer'
import { IgnoredFilesDrawer, UnmatchedFilesDrawer } from '@features/manage-unmatched-files'
import { MatchFileDrawer, matchFileModel } from '@features/match-library-file'
import { scanLibraryModel, ScanModal } from '@features/scan-library'

import styles from './LibraryPage.module.scss'
import { LibraryCollection } from './ui/library-collection/LibraryCollection'
import { LibraryToolbar } from './ui/library-toolbar/LibraryToolbar'

export function LibraryPage() {
	const { t } = useTranslation()

	const [collectionData, collectionPending, startCollection] = useUnit([
		libraryCollectionQuery.$data,
		libraryCollectionQuery.$pending,
		libraryCollectionQuery.start
	])

	const [rootsData, startRoots, startScanStatus] = useUnit([
		libraryRootsQuery.$data,
		libraryRootsQuery.start,
		libraryScanQuery.start
	])

	const scanRequested = useUnit(scanLibraryModel.requested)
	const matchRequestedMany = useUnit(matchFileModel.requestedMany)

	useEffect(() => {
		startCollection()
		startRoots()
		startScanStatus()
	}, [startCollection, startRoots, startScanStatus])

	const collection = collectionData?.collection ?? null
	const entries = collection?.entries ?? []
	const roots = rootsData?.roots ?? []

	const phase =
		entries.length > 0
			? 'collection'
			: collectionPending
				? 'loading'
				: roots.length === 0
					? 'noRoots'
					: 'noFiles'

	const summary = collection
		? [
				t('library.summary.titles', { count: entries.length }),
				t('library.summary.files', { count: collection.files }),
				collection.unmatched > 0
					? t('library.summary.unmatched', { count: collection.unmatched })
					: null
			]
				.filter(Boolean)
				.join(' · ')
		: t('library.description')

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.library')}
				icon={<Icon name='common/file-tree' size={24} />}
				subtitle={summary}
				rightContent={
					<LibraryToolbar
						hasEntries={entries.length > 0}
						hasRoots={roots.length > 0}
						unmatched={collection?.unmatched ?? 0}
					/>
				}
			/>

			<PhaseTransition phase={phase}>
				{phase === 'collection' && <LibraryCollection entries={entries} />}

				{phase === 'noRoots' && (
					<EmptyState
						size='page'
						title={t('library.empty.title')}
						description={t('library.empty.description')}
						action={
							<Link to='/settings' className={styles.link}>
								{t('library.empty.action')}
							</Link>
						}
					/>
				)}

				{phase === 'noFiles' && (
					<EmptyState
						size='page'
						title={t('library.noFiles')}
						description={t('library.noFilesHint')}
						action={
							<Button
								variant='primary'
								startIcon={<LuFolderSync size={16} />}
								onClick={() => scanRequested()}
							>
								{t('library.scan.start')}
							</Button>
						}
					/>
				)}
			</PhaseTransition>

			<ScanModal />
			<UnmatchedFilesDrawer />
			<IgnoredFilesDrawer />
			<LibraryExplorer onMatchMany={files => matchRequestedMany(files)} />
			<MatchFileDrawer />
		</PageTransition>
	)
}
