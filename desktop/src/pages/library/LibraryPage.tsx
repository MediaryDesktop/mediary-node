import { Link, useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, Icon, PageHeader, PageTransition } from '@shared/ui'

import { libraryCollectionQuery, libraryRootsQuery, libraryScanQuery } from '@entities/library-item'

import { scanLibraryModel, ScanModal } from '@features/scan-library'

import { LibraryCollection } from './library-collection/LibraryCollection'
import styles from './LibraryPage.module.scss'

export function LibraryPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

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

	useEffect(() => {
		startCollection()
		startRoots()
		startScanStatus()
	}, [startCollection, startRoots, startScanStatus])

	const collection = collectionData?.collection ?? null
	const entries = collection?.entries ?? []
	const roots = rootsData?.roots ?? []

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
				icon={<Icon name='common/database' size={24} />}
				subtitle={summary}
				rightContent={
					<div className={styles.actions}>
						<Button
							variant='primary'
							startIcon={<Icon name='common/reset' size={16} />}
							onClick={() => scanRequested()}
						>
							{t('library.scan.start')}
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

			{entries.length > 0 && <LibraryCollection entries={entries} />}

			{entries.length === 0 &&
				!collectionPending &&
				(roots.length === 0 ? (
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
				) : (
					<EmptyState
						size='page'
						title={t('library.noFiles')}
						description={t('library.noFilesHint')}
						action={
							<Button variant='primary' onClick={() => scanRequested()}>
								{t('library.scan.start')}
							</Button>
						}
					/>
				))}

			<ScanModal />
		</PageTransition>
	)
}
