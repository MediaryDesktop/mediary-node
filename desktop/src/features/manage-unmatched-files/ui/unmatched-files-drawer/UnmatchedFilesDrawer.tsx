import { useUnit } from 'effector-react'
import { useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, EmptyState, Icon, LoadFailed } from '@shared/ui'

import { useNodeQuery } from '@infra/node'

import { libraryRootsQuery, libraryTreeQuery } from '@entities/library-item'

import { unmatchedGroups } from '../../lib/groups'
import { unmatchedFilesModel } from '../../model/model'

import { GroupPage } from './group-page/GroupPage'
import styles from './UnmatchedFilesDrawer.module.scss'

export function UnmatchedFilesDrawer() {
	const { t } = useTranslation()

	const [open, closed] = useUnit([unmatchedFilesModel.$unmatchedOpen, unmatchedFilesModel.unmatchedClosed])
	const tree = useNodeQuery(libraryTreeQuery, { enabled: Boolean(open) })
	const roots = useNodeQuery(libraryRootsQuery, { enabled: Boolean(open) })
	const treeData = tree.data
	const rootsData = roots.data
	const failed = tree.phase === 'failed' || roots.phase === 'failed'

	const [page, setPage] = useState(0)

	const groups = useMemo(
		() => unmatchedGroups(treeData?.files.items ?? [], rootsData?.roots ?? []),
		[treeData, rootsData]
	)

	const lastPage = Math.max(groups.length - 1, 0)
	const shown = Math.min(page, lastPage)
	const current = groups[shown] ?? null

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && closed()}
			title={t('library.unmatched.title')}
			size='xl'
			closable={false}
		>
			{failed ? (
				<LoadFailed
					onRetry={() => {
						tree.retry()
						roots.retry()
					}}
				/>
			) : current === null ? (
				<EmptyState title={t('library.unmatched.empty')} />
			) : (
				<div className={styles.body}>
					{groups.length > 1 && (
						<div className={styles.pager}>
							<Button
								variant='secondary'
								startIcon={<Icon name='common/arrow-left' size={16} />}
								disabled={shown === 0}
								onClick={() => setPage(shown - 1)}
							>
								{t('library.unmatched.previous')}
							</Button>

							<p className={styles.count}>
								{shown + 1} / {lastPage + 1}
							</p>

							<Button
								variant='secondary'
								endIcon={<Icon name='common/arrow-right' size={16} />}
								disabled={shown >= lastPage}
								onClick={() => setPage(shown + 1)}
							>
								{t('library.unmatched.next')}
							</Button>
						</div>
					)}

					<GroupPage key={current.key} group={current} />
				</div>
			)}
		</Drawer>
	)
}
