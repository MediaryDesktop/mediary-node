import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import {
	AddRootMenu,
	deleteLibraryRootMutation,
	libraryModel,
	libraryRootsQuery,
	updateLibraryRootMutation
} from '@entities/library-item'

import styles from './LibraryRootsSettings.module.scss'
import { RootRow } from './ui/root-row/RootRow'

export function LibraryRootsSettings() {
	const { t } = useTranslation()

	const [rootsData] = useUnit([libraryRootsQuery.$data])

	const [pickingFolder, scanRequested] = useUnit([libraryModel.$pickingFolder, libraryModel.scanRequested])

	const [remove, removing] = useUnit([deleteLibraryRootMutation.start, deleteLibraryRootMutation.$pending])
	const [update, updating] = useUnit([updateLibraryRootMutation.start, updateLibraryRootMutation.$pending])

	useNodeData(libraryRootsQuery)

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

	const roots = rootsData?.roots ?? []

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.library.name')}</h3>
				<p className={styles.hint}>{t('settings.library.hint')}</p>
			</div>

			<p className={styles.note}>
				<Icon name='common/info' size={18} />
				<span>{t('library.root.note')}</span>
			</p>

			{roots.length > 0 ? (
				<div className={styles.list}>
					{roots.map(root => (
						<RootRow
							key={root.id}
							root={root}
							switching={updating}
							removing={removing}
							onRescan={() => scanRequested(root.id)}
							onSwitch={content => update({ id: root.id, content })}
							onRemove={() => remove(root.id)}
						/>
					))}
				</div>
			) : (
				<p className={styles.empty}>{t('library.root.none')}</p>
			)}

			<div className={styles.actions}>
				<AddRootMenu
					trigger={
						<Button
							variant='primary'
							startIcon={<Icon name='common/plus' size={16} />}
							disabled={pickingFolder}
						>
							{t('library.root.add')}
						</Button>
					}
				/>
			</div>
		</div>
	)
}
