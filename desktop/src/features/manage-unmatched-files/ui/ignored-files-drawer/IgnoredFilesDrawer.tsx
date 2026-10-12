import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, EmptyState, Icon } from '@shared/ui'

import { libraryTreeQuery, setLibraryFilesIgnoredMutation } from '@entities/library-item'

import { unmatchedFilesModel } from '../../model/model'
import { CheckRow } from '../check-row/CheckRow'

import styles from './IgnoredFilesDrawer.module.scss'

export function IgnoredFilesDrawer() {
	const { t } = useTranslation()

	const [open, closed] = useUnit([unmatchedFilesModel.$ignoredOpen, unmatchedFilesModel.ignoredClosed])
	const [treeData, startTree] = useUnit([libraryTreeQuery.$data, libraryTreeQuery.start])
	const [unignore, pending] = useUnit([
		setLibraryFilesIgnoredMutation.start,
		setLibraryFilesIgnoredMutation.$pending
	])

	const [selected, setSelected] = useState<Set<number>>(new Set())

	useEffect(() => {
		if (open) {
			startTree()
		}
	}, [open, startTree])

	const files = useMemo(() => (treeData?.files.items ?? []).filter(file => file.ignored), [treeData])

	const picked = files.filter(file => selected.has(file.id))
	const allState = picked.length === 0 ? false : picked.length === files.length ? true : 'mixed'

	return (
		<Drawer
			open={open}
			onOpenChange={next => {
				if (!next) {
					setSelected(new Set())
					closed()
				}
			}}
			title={t('library.unmatched.ignoredTitle')}
			size='xl'
		>
			{files.length === 0 ? (
				<EmptyState title={t('library.unmatched.noneIgnored')} />
			) : (
				<div className={styles.body}>
					<div className={styles.actions}>
						<Button
							variant='primary'
							size='small'
							startIcon={<Icon name='common/eye' size={14} />}
							disabled={picked.length === 0}
							loading={pending}
							onClick={() => {
								unignore(picked.map(file => ({ fileId: file.id, ignored: false })))
								setSelected(new Set())
							}}
						>
							{t('library.unmatched.unignoreSelection')}
						</Button>
					</div>

					<div className={styles.files}>
						<CheckRow
							checked={allState}
							label={t('library.unmatched.selectAll')}
							onCheckedChange={checked =>
								setSelected(new Set(checked ? files.map(file => file.id) : []))
							}
						/>

						{files.map(file => (
							<CheckRow
								key={file.id}
								checked={selected.has(file.id)}
								label={file.path}
								onCheckedChange={checked =>
									setSelected(current => {
										const next = new Set(current)

										if (checked) {
											next.add(file.id)
										} else {
											next.delete(file.id)
										}

										return next
									})
								}
							/>
						))}
					</div>
				</div>
			)}
		</Drawer>
	)
}
