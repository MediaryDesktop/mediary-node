import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Icon, Tooltip } from '@shared/ui'

import { deleteLibraryRootMutation } from '@entities/library-item'
import type { LibraryRoot } from '@entities/library-item'

import styles from './LibraryRoots.module.scss'

export interface LibraryRootsProps {
	roots: LibraryRoot[]
}

export function LibraryRoots({ roots }: LibraryRootsProps) {
	const { t } = useTranslation()

	const [remove, removing] = useUnit([deleteLibraryRootMutation.start, deleteLibraryRootMutation.$pending])

	return (
		<section className={styles.roots}>
			{roots.map(root => (
				<article key={root.id} className={styles.root}>
					<Icon name='common/folder' size={18} className={styles.icon} />

					<div className={styles.body}>
						<p className={styles.path}>{root.path}</p>

						<p className={styles.counts}>
							{t('library.root.files', { count: root.file_count })}
							{root.missing_count > 0 && (
								<span className={styles.missing}>
									{t('library.root.missing', { count: root.missing_count })}
								</span>
							)}
						</p>
					</div>

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
		</section>
	)
}
