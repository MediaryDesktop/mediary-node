import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, EmptyState, Icon } from '@shared/ui'

import { libraryTreeQuery } from '@entities/library-item'

import { unmatchedGroups } from '../../lib/groups'
import { unmatchedFilesModel } from '../../model/model'

import { GroupPage } from './group-page/GroupPage'
import styles from './UnmatchedFilesDrawer.module.scss'

// The design works through unmatched files a folder at a time: a page per
// folder, every file on it picked by default, one title applied to the pick.
export function UnmatchedFilesDrawer() {
	const { t } = useTranslation()

	const [open, closed] = useUnit([unmatchedFilesModel.$unmatchedOpen, unmatchedFilesModel.unmatchedClosed])
	const [treeData, startTree] = useUnit([libraryTreeQuery.$data, libraryTreeQuery.start])

	const [page, setPage] = useState(0)

	useEffect(() => {
		if (open) {
			startTree()
		}
	}, [open, startTree])

	const groups = useMemo(() => unmatchedGroups(treeData?.files.items ?? []), [treeData])

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
			{current === null ? (
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

					{/* Keyed by folder, so a new page starts from its own defaults. */}
					<GroupPage key={current.key} group={current} />
				</div>
			)}
		</Drawer>
	)
}
