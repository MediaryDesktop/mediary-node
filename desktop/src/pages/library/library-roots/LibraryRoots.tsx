import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, Tooltip } from '@shared/ui'

import { deleteLibraryRootMutation, libraryModel } from '@entities/library-item'
import type { LibraryRoot } from '@entities/library-item'

import styles from './LibraryRoots.module.scss'

export interface LibraryRootsProps {
	roots: LibraryRoot[]
	scanning: boolean
}

export function LibraryRoots({ roots, scanning }: LibraryRootsProps) {
	const { t } = useTranslation()

	const [remove, removing] = useUnit([deleteLibraryRootMutation.start, deleteLibraryRootMutation.$pending])

	const rescan = useUnit(libraryModel.scanRequested)

	return (
		<section className={styles.section}>
			<header className={styles.heading}>
				<h2 className={styles.title}>
					<Icon name='common/folder' size={18} />
					{t('library.root.section')}
				</h2>
			</header>

			<div className={styles.roots}>
				{roots.map(root => (
					<article key={root.id} className={styles.root}>
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
									disabled: scanning,
									onSelect: () => rescan(root.id)
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

						<Tooltip content={t('library.root.remove')}>
							<button
								type='button'
								className={styles.remove}
								aria-label={t('library.root.remove')}
								disabled={removing}
								onClick={() => remove(root.id)}
							>
								<Icon name='common/trash' size={16} />
							</button>
						</Tooltip>
					</article>
				))}
			</div>
		</section>
	)
}
