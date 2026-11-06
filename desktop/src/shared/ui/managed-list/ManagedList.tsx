import type { ReactNode } from 'react'

import styles from './ManagedList.module.scss'

export interface ManagedListProps<T> {
	items: T[]
	renderItem: (item: T) => ReactNode
	emptyText: string
	note?: string
	action: ReactNode
}

export function ManagedList<T>({ items, renderItem, emptyText, note, action }: ManagedListProps<T>) {
	return (
		<div className={styles.root}>
			{note && <p className={styles.note}>{note}</p>}

			{items.length === 0 ? (
				<p className={styles.empty}>{emptyText}</p>
			) : (
				<ul className={styles.items}>{items.map(renderItem)}</ul>
			)}

			{action}
		</div>
	)
}
