import clsx from 'clsx'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'
import { RippleButton } from '../ripple/RippleButton'

import { pageItems } from './lib/pageItems'
import styles from './Pagination.module.scss'

export interface PaginationProps {
	page: number
	pages: number
	onPageChange: (page: number) => void
	className?: string
}

export function Pagination({ page, pages, onPageChange, className }: PaginationProps) {
	const { t } = useTranslation()

	if (pages <= 1) {
		return null
	}

	return (
		<nav className={clsx(styles.root, className)} aria-label={t('pagination.label')}>
			<RippleButton
				className={styles.step}
				aria-label={t('pagination.previous')}
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
			>
				<Icon name='common/arrow-left' size={16} />
			</RippleButton>

			{pageItems(page, pages).map((item, index) =>
				item === 'gap' ? (
					<span key={`gap-${index}`} className={styles.gap} aria-hidden>
						…
					</span>
				) : (
					<RippleButton
						key={item}
						className={clsx(styles.page, item === page && styles.current)}
						aria-label={t('pagination.page', { page: item })}
						aria-current={item === page ? 'page' : undefined}
						onClick={() => onPageChange(item)}
					>
						{item}
					</RippleButton>
				)
			)}

			<RippleButton
				className={styles.step}
				aria-label={t('pagination.next')}
				disabled={page >= pages}
				onClick={() => onPageChange(page + 1)}
			>
				<Icon name='common/arrow-right' size={16} />
			</RippleButton>
		</nav>
	)
}
