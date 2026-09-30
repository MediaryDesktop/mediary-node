import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, Tooltip } from '@shared/ui'

import { unmatchedFilesModel } from '@features/manage-unmatched-files'
import { scanLibraryModel } from '@features/scan-library'

import styles from './LibraryToolbar.module.scss'

export interface LibraryToolbarProps {
	hasEntries: boolean
	hasRoots: boolean
	unmatched: number
}

// The same row, in the same order, as the library toolbar the design follows:
// the explorer, the scan, the unmatched files when there are any, and a menu for
// everything used less often.
export function LibraryToolbar({ hasEntries, hasRoots, unmatched }: LibraryToolbarProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [scanRequested, unmatchedRequested, viewChanged] = useUnit([
		scanLibraryModel.requested,
		unmatchedFilesModel.requested,
		unmatchedFilesModel.viewChanged
	])

	return (
		<div className={styles.toolbar}>
			{hasRoots && (
				<Tooltip content={t('library.toolbar.explorer')}>
					<Button
						variant='ghost'
						iconOnly
						aria-label={t('library.toolbar.explorer')}
						className={unmatched > 0 ? styles.pulse : undefined}
						onClick={() => navigate({ to: '/library/explorer' })}
					>
						<Icon name='common/folder-tree' size={20} />
					</Button>
				</Tooltip>
			)}

			{hasRoots && (
				<Tooltip
					content={hasEntries ? t('library.toolbar.refreshHint') : t('library.toolbar.scanHint')}
				>
					<Button
						variant={hasEntries ? 'secondary' : 'primary'}
						startIcon={<Icon name={hasEntries ? 'common/reset' : 'common/search'} size={16} />}
						onClick={() => scanRequested()}
					>
						{hasEntries ? t('library.toolbar.refresh') : t('library.scan.start')}
					</Button>
				</Tooltip>
			)}

			{unmatched > 0 && (
				<Button
					variant='primary'
					startIcon={<Icon name='common/library' size={16} />}
					className={styles.alert}
					onClick={() => {
						viewChanged('unmatched')
						unmatchedRequested()
					}}
				>
					{t('library.toolbar.resolveUnmatched', { count: unmatched })}
				</Button>
			)}

			{hasRoots && (
				<DropdownMenu
					align='end'
					items={[
						{
							id: 'ignored',
							label: t('library.toolbar.ignoredFiles'),
							icon: 'common/eye-off',
							onSelect: () => {
								viewChanged('ignored')
								unmatchedRequested()
							}
						},
						{
							id: 'summaries',
							label: t('library.toolbar.scanSummaries'),
							icon: 'common/clock',
							onSelect: () => navigate({ to: '/library/history' })
						}
					]}
					trigger={
						<Button variant='ghost' iconOnly aria-label={t('library.toolbar.more')}>
							<Icon name='common/more-vertical' size={20} />
						</Button>
					}
				/>
			)}
		</div>
	)
}
