import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, Modal } from '@shared/ui'

import { deleteLibraryFilesMutation } from '@entities/library-item'
import type { LibraryFile } from '@entities/library-item'

import styles from './DeleteFilesModal.module.scss'

const LISTED = 8

export interface DeleteFilesModalProps {
	open: boolean
	files: LibraryFile[]
	onClose: () => void
	onDeleted: () => void
}

export function DeleteFilesModal({ open, files, onClose, onDeleted }: DeleteFilesModalProps) {
	const { t } = useTranslation()
	const [deleteFiles, deleting] = useUnit([
		deleteLibraryFilesMutation.start,
		deleteLibraryFilesMutation.$pending
	])

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && onClose()}
			title={t('library.explorer.deleteTitle', { count: files.length })}
			description={t('library.file.deleteFileWarning')}
			size='sm'
			footer={
				<>
					<Button variant='secondary' disabled={deleting} onClick={onClose}>
						{t('common.cancel')}
					</Button>

					<Button
						variant='primary'
						loading={deleting}
						onClick={() => {
							deleteFiles(files.map(file => file.id))
							onClose()
							onDeleted()
						}}
					>
						{t('library.explorer.deleteFiles', { count: files.length })}
					</Button>
				</>
			}
		>
			<ul className={styles.deleteList}>
				{files.slice(0, LISTED).map(file => (
					<li key={file.id}>{file.rel_path}</li>
				))}
				{files.length > LISTED && (
					<li>{t('library.explorer.andMore', { count: files.length - LISTED })}</li>
				)}
			</ul>
		</Modal>
	)
}
