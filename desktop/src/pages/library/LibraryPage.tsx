import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, PageHeader, PageTransition } from '@shared/ui'

import { libraryRootsQuery, libraryScanQuery } from '@entities/library-item'

import { scanLibraryModel, ScanModal } from '@features/scan-library'

import styles from './LibraryPage.module.scss'

export function LibraryPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [startRoots, startScanStatus] = useUnit([libraryRootsQuery.start, libraryScanQuery.start])
	const scanRequested = useUnit(scanLibraryModel.requested)

	useEffect(() => {
		startRoots()
		startScanStatus()
	}, [startRoots, startScanStatus])

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

			<ScanModal />
		</PageTransition>
	)
}
