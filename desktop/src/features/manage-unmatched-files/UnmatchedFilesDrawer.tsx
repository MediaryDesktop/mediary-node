import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, EmptyState, Modal, SegmentedControl } from '@shared/ui'

import { deleteLibraryFileMutation, LibraryFileRow, libraryFilesQuery } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import { unmatchedFilesModel } from './model'
import type { UnmatchedView } from './model'
import styles from './UnmatchedFilesDrawer.module.scss'

const VIEWS: UnmatchedView[] = ['unmatched', 'ignored']

export interface UnmatchedFilesDrawerProps {
	// Matching lives in its own slice, so the page hands this in rather than the
	// two features reaching into each other.
	onMatch: (file: LibraryFile) => void
}

export function UnmatchedFilesDrawer({ onMatch }: UnmatchedFilesDrawerProps) {
	const { t } = useTranslation()

	const [open, view, pendingDelete] = useUnit([
		unmatchedFilesModel.$open,
		unmatchedFilesModel.$view,
		unmatchedFilesModel.$pendingDelete
	])

	const [closed, viewChanged, ignoreRequested, deleteRequested, deleteCancelled, deleteConfirmed] = useUnit(
		[
			unmatchedFilesModel.closed,
			unmatchedFilesModel.viewChanged,
			unmatchedFilesModel.ignoreRequested,
			unmatchedFilesModel.deleteRequested,
			unmatchedFilesModel.deleteCancelled,
			unmatchedFilesModel.deleteConfirmed
		]
	)

	const [page, pending] = useUnit([libraryFilesQuery.$data, libraryFilesQuery.$pending])
	const deleting = useUnit(deleteLibraryFileMutation.$pending)

	const files = page?.files.items ?? []

	return (
		<>
			<Drawer
				open={open}
				onOpenChange={next => !next && closed()}
				title={t('library.unmatched.title')}
				description={t('library.unmatched.description')}
				size='lg'
			>
				<div className={styles.body}>
					<SegmentedControl
						items={VIEWS.map(mode => ({
							value: mode,
							label: t(`library.unmatched.view.${mode}`)
						}))}
						value={view}
						onValueChange={viewChanged}
					/>

					{files.length > 0 ? (
						<div className={styles.rows}>
							{files.map(file => (
								<LibraryFileRow
									key={file.id}
									file={file}
									onMatch={onMatch}
									onIgnore={(target, ignored) =>
										ignoreRequested({ fileId: target.id, ignored })
									}
									onDelete={target => deleteRequested(target)}
								/>
							))}
						</div>
					) : (
						!pending && (
							<EmptyState
								title={
									view === 'unmatched'
										? t('library.unmatched.empty')
										: t('library.unmatched.noneIgnored')
								}
							/>
						)
					)}
				</div>
			</Drawer>

			<Modal
				open={pendingDelete !== null}
				onOpenChange={next => !next && deleteCancelled()}
				title={t('library.file.deleteFileTitle')}
				description={t('library.file.deleteFileWarning')}
				size='sm'
				footer={
					<>
						<Button variant='secondary' onClick={() => deleteCancelled()} disabled={deleting}>
							{t('common.cancel')}
						</Button>

						<Button variant='primary' onClick={() => deleteConfirmed()} loading={deleting}>
							{t('library.file.deleteFile')}
						</Button>
					</>
				}
			>
				<p className={styles.path}>{pendingDelete?.path}</p>
			</Modal>
		</>
	)
}
