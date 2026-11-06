import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Modal } from '@shared/ui'

import { putBookDownloadSettingsMutation } from '@entities/book-source'
import { libraryRootsQuery } from '@entities/library-item'

import { $promptOpen, folderChosen, promptClosed } from '../../model/model'

import styles from './BookFolderPrompt.module.scss'

export function BookFolderPrompt() {
	const { t } = useTranslation()

	const [open, choose, close, roots, loadRoots, saving] = useUnit([
		$promptOpen,
		folderChosen,
		promptClosed,
		libraryRootsQuery.$data,
		libraryRootsQuery.start,
		putBookDownloadSettingsMutation.$pending
	])

	useEffect(() => {
		if (open) {
			loadRoots()
		}
	}, [open, loadRoots])

	const folders = (roots?.roots ?? []).filter(root => root.content === 'books')

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && close()}
			title={t('bookSources.downloads.folderTitle')}
			description={t('bookSources.downloads.folderDescription')}
			size='sm'
		>
			{folders.length === 0 ? (
				<p className={styles.empty}>{t('bookSources.downloads.noFolders')}</p>
			) : (
				<ul className={styles.folders}>
					{folders.map(root => (
						<li key={root.id}>
							<Button
								fullWidth
								disabled={saving}
								startIcon={<Icon name='common/folder' size={16} />}
								className={styles.folder}
								onClick={() => choose(root.id)}
							>
								<span className={styles.path}>{root.path}</span>
							</Button>
						</li>
					))}
				</ul>
			)}
		</Modal>
	)
}
