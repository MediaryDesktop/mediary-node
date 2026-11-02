import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, ListTile, ManagedList, MoreMenu, toast } from '@shared/ui'

import {
	AddRootMenu,
	deleteLibraryRootMutation,
	LIBRARY_CONTENT_ICONS,
	LIBRARY_CONTENTS,
	libraryModel,
	libraryRootsQuery,
	updateLibraryRootMutation
} from '@entities/library-item'

const CONTENTS = LIBRARY_CONTENTS
const CONTENT_ICONS = LIBRARY_CONTENT_ICONS

export function LibraryRootsSettings() {
	const { t } = useTranslation()

	const [rootsData, startRoots] = useUnit([libraryRootsQuery.$data, libraryRootsQuery.start])

	const [pickingFolder, scanRequested] = useUnit([libraryModel.$pickingFolder, libraryModel.scanRequested])

	const [remove, removing] = useUnit([deleteLibraryRootMutation.start, deleteLibraryRootMutation.$pending])
	const [update, updating] = useUnit([updateLibraryRootMutation.start, updateLibraryRootMutation.$pending])

	useEffect(() => {
		startRoots()
	}, [startRoots])

	useUnitWatch(libraryModel.rootAddFailed, ({ error }) =>
		toast.error(
			error.status === 409
				? problemDetail(error, t('library.root.overlap'))
				: problemDetail(error, t('library.root.failed')),
			{ id: 'library-root-failed' }
		)
	)
	useUnitWatch(libraryModel.rootDeleteFailed, () =>
		toast.error(t('library.root.removeFailed'), { id: 'library-root-remove-failed' })
	)
	useUnitWatch(libraryModel.rootUpdateFailed, () =>
		toast.error(t('library.root.contentFailed'), { id: 'library-root-content-failed' })
	)

	return (
		<ManagedList
			items={rootsData?.roots ?? []}
			note={t('library.root.note')}
			emptyText={t('library.root.none')}
			renderItem={root => (
				<ListTile
					key={root.id}
					as='li'
					icon={CONTENT_ICONS[root.content]}
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
						<MoreMenu
							label={t('library.root.menu')}
							items={[
								{
									id: 'rescan',
									label: t('library.root.rescan'),
									icon: <IoIosRefresh size={20} />,
									onSelect: () => scanRequested(root.id)
								},
								...CONTENTS.map(content => ({
									id: `content-${content}`,
									label: t(`library.root.switchTo.${content}`),
									icon: CONTENT_ICONS[content],
									checked: content === root.content,
									disabled: updating,
									onSelect: () => {
										if (content !== root.content) {
											update({ id: root.id, content })
										}
									}
								})),
								{
									id: 'remove',
									label: t('library.root.remove'),
									icon: 'common/trash',
									danger: true,
									disabled: removing,
									onSelect: () => remove(root.id)
								}
							]}
						/>
					}
				/>
			)}
			action={
				<AddRootMenu
					trigger={
						<Button
							startIcon={<Icon name='common/folder-open' size={16} />}
							disabled={pickingFolder}
						>
							{t('library.root.add')}
						</Button>
					}
				/>
			}
		/>
	)
}
