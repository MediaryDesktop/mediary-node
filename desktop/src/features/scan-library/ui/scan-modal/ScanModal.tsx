import { useUnit } from 'effector-react'
import { useState } from 'react'
import { LuFolderSync } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Button, Modal, SelectDropdown } from '@shared/ui'

import { libraryModel, libraryRootsQuery } from '@entities/library-item'

import { scanLibraryModel } from '../../model/model'

import styles from './ScanModal.module.scss'

const ALL_FOLDERS = 'all'

export function ScanModal() {
	const { t } = useTranslation()

	const [open, closed, started] = useUnit([
		scanLibraryModel.$open,
		scanLibraryModel.closed,
		scanLibraryModel.started
	])

	const [rootsData, activity] = useUnit([libraryRootsQuery.$data, libraryModel.$activity])

	const [target, setTarget] = useState<string>(ALL_FOLDERS)

	const roots = rootsData?.roots ?? []
	const scanning = activity !== null

	const options = [
		{ value: ALL_FOLDERS, label: t('library.scan.allFolders') },
		...roots.map(root => ({ value: String(root.id), label: root.path }))
	]

	return (
		<Modal open={open} onOpenChange={next => !next && closed()} title={t('library.scan.title')} size='md'>
			<div className={styles.body}>
				<section className={styles.section}>
					<h5 className={styles.heading}>{t('library.scan.folders')}</h5>

					{roots.length === 0 ? (
						<p className={styles.hint}>{t('library.scan.noRoots')}</p>
					) : (
						<SelectDropdown
							options={options}
							value={target}
							onChange={value => setTarget(value ?? ALL_FOLDERS)}
						/>
					)}
				</section>

				<hr className={styles.separator} />

				<Button
					variant='primary'
					fullWidth
					loading={scanning}
					startIcon={<LuFolderSync size={16} />}
					disabled={roots.length === 0 || scanning}
					onClick={() => started(target === ALL_FOLDERS ? 0 : Number(target))}
				>
					{t('library.scan.start')}
				</Button>
			</div>
		</Modal>
	)
}
