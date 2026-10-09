import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon, ListTile, toast } from '@shared/ui'

import {
	deleteLibraryRootMutation,
	libraryModel,
	libraryRootsQuery,
	updateLibraryRootMutation
} from '@entities/library-item'
import type { LibraryContent } from '@entities/library-item'

import styles from './LibraryRootsSettings.module.scss'

const CONTENTS = ['anime', 'movies_and_shows'] as const satisfies readonly LibraryContent[]

function otherContent(content: LibraryContent): LibraryContent {
	return content === 'anime' ? 'movies_and_shows' : 'anime'
}

export function LibraryRootsSettings() {
	const { t } = useTranslation()

	const [rootsData, startRoots] = useUnit([libraryRootsQuery.$data, libraryRootsQuery.start])

	const [pickingFolder, folderRequested, scanRequested] = useUnit([
		libraryModel.$pickingFolder,
		libraryModel.folderRequested,
		libraryModel.scanRequested
	])

	const [remove, removing] = useUnit([deleteLibraryRootMutation.start, deleteLibraryRootMutation.$pending])
	const [update, updating] = useUnit([updateLibraryRootMutation.start, updateLibraryRootMutation.$pending])

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
			),
			libraryModel.rootUpdateFailed.watch(() =>
				toast.error(t('library.root.contentFailed'), { id: 'library-root-content-failed' })
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	const roots = rootsData?.roots ?? []

	return (
		<div className={styles.root}>
			<p className={styles.note}>{t('library.root.note')}</p>

			{roots.length === 0 ? (
				<p className={styles.empty}>{t('library.root.none')}</p>
			) : (
				<ul className={styles.roots}>
					{roots.map(root => (
						<ListTile
							key={root.id}
							as='li'
							icon='common/folder'
							title={root.path}
							titleHint={root.path}
							subtitle={[
								t(`library.root.content.${root.content}`),
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
							actions={
								<DropdownMenu
									items={[
										{
											id: 'rescan',
											label: t('library.root.rescan'),
											icon: 'common/reset',
											onSelect: () => scanRequested(root.id)
										},
										{
											id: 'content',
											label: t(`library.root.switchTo.${otherContent(root.content)}`),
											icon: 'common/player',
											disabled: updating,
											onSelect: () =>
												update({ id: root.id, content: otherContent(root.content) })
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
										<Button
											size='small'
											variant='ghost'
											iconOnly
											aria-label={t('library.root.menu')}
											startIcon={<Icon name='common/more-vertical' size={16} />}
										/>
									}
								/>
							}
						/>
					))}
				</ul>
			)}

			<DropdownMenu
				items={CONTENTS.map(content => ({
					id: content,
					label: t(`library.root.addAs.${content}`),
					icon: content === 'anime' ? 'categories/anime' : 'categories/movie',
					disabled: pickingFolder,
					onSelect: () => folderRequested(content)
				}))}
				trigger={
					<Button startIcon={<Icon name='common/folder-open' size={16} />} disabled={pickingFolder}>
						{t('library.root.add')}
					</Button>
				}
			/>
		</div>
	)
}
