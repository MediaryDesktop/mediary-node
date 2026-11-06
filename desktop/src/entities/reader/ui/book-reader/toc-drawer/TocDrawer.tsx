import type { FoliateTocItem } from 'foliate-js/view.js'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Drawer, ProgressBar } from '@shared/ui'

import { indexToc } from '../../../lib/toc'

import { TocList } from './toc-list/TocList'
import styles from './TocDrawer.module.scss'

export interface TocDrawerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	toc: FoliateTocItem[]
	current: string | null
	onOpen: (href: string) => void
}

export function TocDrawer({ open, onOpenChange, toc, current, onOpen }: TocDrawerProps) {
	const { t } = useTranslation()
	const tocIndex = useMemo(() => indexToc(toc, current), [toc, current])

	return (
		<Drawer
			open={open}
			onOpenChange={onOpenChange}
			title={t('reader.book.contents')}
			closable={false}
			side='right'
			size='sm'
		>
			<div className={styles.tocPanel}>
				{toc.length > 0 && <span className={styles.tocLabel}>{t('reader.book.chapters')}</span>}

				<div className={styles.tocScroll}>
					<TocList items={toc} numbers={tocIndex.numbers} current={current} onOpen={onOpen} />
				</div>

				{tocIndex.total > 0 && (
					<div className={styles.tocFooter}>
						<span>
							{tocIndex.current != null
								? t('reader.book.contentsProgress', {
										current: tocIndex.current,
										count: tocIndex.total
									})
								: t('reader.book.contentsTotal', { count: tocIndex.total })}
						</span>
						<ProgressBar value={tocIndex.current ?? 0} max={tocIndex.total} />
					</div>
				)}
			</div>
		</Drawer>
	)
}
