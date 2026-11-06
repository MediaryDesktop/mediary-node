import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { IoIosRefresh } from 'react-icons/io'
import { IoLibraryOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { libraryExplorerModel } from '@features/library-explorer'
import { unmatchedFilesModel } from '@features/manage-unmatched-files'
import { scanLibraryModel } from '@features/scan-library'

import styles from './LibraryToolbar.module.scss'

export interface LibraryToolbarProps {
	hasEntries: boolean
	hasRoots: boolean
	unmatched: number
}

export function LibraryToolbar({ hasEntries, hasRoots, unmatched }: LibraryToolbarProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [explorerRequested, scanRequested, unmatchedRequested, ignoredRequested] = useUnit([
		libraryExplorerModel.requested,
		scanLibraryModel.requested,
		unmatchedFilesModel.unmatchedRequested,
		unmatchedFilesModel.ignoredRequested
	])

	const menuItems: DropdownMenuItem[] = []

	if (hasRoots) {
		menuItems.push({
			id: 'scan',
			label: hasEntries ? t('library.toolbar.refresh') : t('library.scan.start'),
			icon: <IoIosRefresh size={20} />,
			onSelect: () => scanRequested()
		})
	}

	if (unmatched > 0) {
		menuItems.push({
			id: 'unmatched',
			label: t('library.toolbar.resolveUnmatched', { count: unmatched }),
			icon: <IoLibraryOutline size={20} />,
			onSelect: () => unmatchedRequested()
		})
	}

	if (hasRoots) {
		menuItems.push(
			{
				id: 'ignored',
				label: t('library.toolbar.ignoredFiles'),
				icon: 'common/eye-off',
				onSelect: () => ignoredRequested()
			},
			{
				id: 'summaries',
				label: t('library.toolbar.scanSummaries'),
				icon: 'common/clock',
				onSelect: () => navigate({ to: '/library/history' })
			}
		)
	}

	return (
		<div className={styles.toolbar}>
			{hasRoots && (
				<Button
					variant='primary'
					startIcon={<Icon name='common/folder-tree' size={16} />}
					onClick={() => explorerRequested()}
				>
					{t('library.toolbar.explorer')}
				</Button>
			)}

			{menuItems.length > 0 && (
				<DropdownMenu
					align='end'
					items={menuItems}
					trigger={
						<Button variant='secondary' iconOnly aria-label={t('library.toolbar.more')}>
							<Icon name='common/more-vertical' size={20} />
						</Button>
					}
				/>
			)}
		</div>
	)
}
