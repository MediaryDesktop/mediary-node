import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, toast } from '@shared/ui'

import { deleteLibraryRootMutation, libraryModel, libraryRootsQuery } from '@entities/library-item'

import styles from './LibraryRootsSettings.module.scss'

export function LibraryRootsSettings() {
	const { t } = useTranslation()

	const [rootsData, startRoots] = useUnit([libraryRootsQuery.$data, libraryRootsQuery.start])

	const [pickingFolder, folderRequested, scanRequested] = useUnit([
		libraryModel.$pickingFolder,
		libraryModel.folderRequested,
		libraryModel.scanRequested
	])

	const [remove, removing] = useUnit([deleteLibraryRootMutation.start, deleteLibraryRootMutation.$pending])

	useEffect(() => {
		startRoots()
	}, [startRoots])

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
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	const roots = rootsData?.roots ?? []

	return (
		<div className={styles.root}>
			{roots.length === 0 ? (
				<p className={styles.empty}>{t('library.root.none')}</p>
			) : (
				<ul className={styles.roots}>
					{roots.map(root => (
						<li key={root.id} className={styles.folder}>
							<span className={styles.icon}>
								<Icon name='common/folder' size={18} />
							</span>

							<div className={styles.body}>
								<p className={styles.path} title={root.path}>
									{root.path}
								</p>

								<p className={styles.counts}>
									{[
										t('library.root.files', { count: root.file_count }),
										root.unmatched_count > 0
											? t('library.summary.unmatched', { count: root.unmatched_count })
											: null,
										root.missing_count > 0
											? t('library.root.missing', { count: root.missing_count })
											: null
									]
										.filter(Boolean)
										.join(' · ')}
								</p>
							</div>

							<DropdownMenu
								items={[
									{
										id: 'rescan',
										label: t('library.root.rescan'),
										icon: 'common/reset',
										onSelect: () => scanRequested(root.id)
									},
									{
										id: 'remove',
										label: t('library.root.remove'),
										icon: 'common/trash',
										danger: true,
										disabled: removing,
										onSelect: () => remove(root.id)
									}
								]}
								trigger={
									<button
										type='button'
										className={styles.action}
										aria-label={t('library.root.menu')}
									>
										<Icon name='common/more-vertical' size={16} />
									</button>
								}
							/>
						</li>
					))}
				</ul>
			)}

			<Button
				startIcon={<Icon name='common/folder-open' size={16} />}
				disabled={pickingFolder}
				onClick={() => folderRequested()}
			>
				{t('library.root.add')}
			</Button>
		</div>
	)
}
