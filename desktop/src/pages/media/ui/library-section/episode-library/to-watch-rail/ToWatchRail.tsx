import { useRef } from 'react'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import styles from './ToWatchRail.module.scss'

export function ToWatchRail({ children }: { children: ReactNode }) {
	const { t } = useTranslation()
	const rail = useRef<HTMLUListElement>(null)

	const scroll = (direction: -1 | 1) => {
		const element = rail.current
		if (element) {
			element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: 'smooth' })
		}
	}

	return (
		<div className={styles.rail}>
			<div className={styles.railControls}>
				<Button
					variant='ghost'
					size='small'
					iconOnly
					aria-label={t('media.library.previous')}
					startIcon={<Icon name='common/arrow-left' size={18} />}
					onClick={() => scroll(-1)}
				/>
				<Button
					variant='ghost'
					size='small'
					iconOnly
					aria-label={t('media.library.next')}
					startIcon={<Icon name='common/arrow-right' size={18} />}
					onClick={() => scroll(1)}
				/>
			</div>

			<ul ref={rail} className={styles.toWatch} aria-label={t('media.library.toWatch')}>
				{children}
			</ul>
		</div>
	)
}
