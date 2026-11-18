import { Icon } from '@shared/ui'

import type { BookDownload, BookEdition } from '@entities/book-source'

import styles from '../FreeCopies.module.scss'

import { FormatAction } from './format-action/FormatAction'

export interface EditionRowProps {
	edition: BookEdition
	mediaRef: string
	downloads: BookDownload[]
}

export function EditionRow({ edition, mediaRef, downloads }: EditionRowProps) {
	const meta = [
		(edition.authors ?? []).join(', '),
		edition.source,
		edition.language?.toUpperCase(),
		edition.year ? String(edition.year) : ''
	].filter(Boolean)

	return (
		<li className={styles.row}>
			<span className={styles.icon} aria-hidden>
				<Icon name='categories/book' size={18} />
			</span>

			<div className={styles.body}>
				<p className={styles.name} title={edition.title}>
					{edition.title}
				</p>
				<span className={styles.meta}>{meta.join(' · ')}</span>
			</div>

			<div className={styles.formats}>
				{(edition.formats ?? []).map(format => (
					<FormatAction
						key={format.type}
						edition={edition}
						format={format}
						mediaRef={mediaRef}
						download={downloads.find(
							item => item.edition_ref === edition.ref && item.format === format.type
						)}
					/>
				))}
			</div>
		</li>
	)
}
