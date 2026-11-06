import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Modal, toast } from '@shared/ui'

import { libraryRootsQuery } from '@entities/library-item'
import { enqueueMangaDownloadsMutation, putMangaDownloadSettingsMutation } from '@entities/manga-source'

import { $promptOpen, folderChosen, promptClosed } from '../../model/model'

import styles from './DownloadFolderPrompt.module.scss'

export function DownloadFolderPrompt() {
	const { t } = useTranslation()

	const [open, choose, close, roots, loadRoots, saving] = useUnit([
		$promptOpen,
		folderChosen,
		promptClosed,
		libraryRootsQuery.$data,
		libraryRootsQuery.start,
		putMangaDownloadSettingsMutation.$pending
	])

	useEffect(() => {
		if (open) {
			loadRoots()
		}
	}, [open, loadRoots])

	useUnitWatch(enqueueMangaDownloadsMutation.finished.success, ({ result }) =>
		toast.success(t('mangaSources.downloads.queued', { count: result.downloads?.length ?? 0 }), {
			id: 'manga-download-queued'
		})
	)
	useUnitWatch(enqueueMangaDownloadsMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('mangaSources.downloads.failedToQueue')), {
			id: 'manga-download-failed'
		})
	)

	const folders = roots?.roots ?? []

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && close()}
			title={t('mangaSources.downloads.folderTitle')}
			description={t('mangaSources.downloads.folderDescription')}
			size='sm'
		>
			{folders.length === 0 ? (
				<p className={styles.empty}>{t('mangaSources.downloads.noFolders')}</p>
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
