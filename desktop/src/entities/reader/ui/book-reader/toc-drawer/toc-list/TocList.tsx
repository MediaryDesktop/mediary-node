import clsx from 'clsx'
import type { FoliateTocItem } from 'foliate-js/view.js'

import { Icon, RippleButton } from '@shared/ui'

import styles from './TocList.module.scss'

export interface TocListProps {
	items: FoliateTocItem[]
	numbers: WeakMap<FoliateTocItem, number>
	current: string | null
	onOpen: (href: string) => void
}

export function TocList({ items, numbers, current, onOpen }: TocListProps) {
	return (
		<ul className={styles.tocList}>
			{items.map(item => {
				const active = item.label.trim() === current
				const number = numbers.get(item)

				return (
					<li key={`${item.href}-${item.label}`}>
						<RippleButton
							className={clsx(styles.tocItem, active && styles.active)}
							onClick={() => onOpen(item.href)}
						>
							{number != null && <span className={styles.tocNumber}>{number}.</span>}
							<span className={styles.tocLabelText}>{item.label.trim()}</span>
							<Icon name='common/chevron-down' size={14} className={styles.tocChevron} />
						</RippleButton>
						{item.subitems && item.subitems.length > 0 && (
							<TocList
								items={item.subitems}
								numbers={numbers}
								current={current}
								onOpen={onOpen}
							/>
						)}
					</li>
				)
			})}
		</ul>
	)
}
