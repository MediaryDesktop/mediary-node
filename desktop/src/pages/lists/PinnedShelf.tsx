import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { EmptyState, Icon, ProgressBar } from '@shared/ui'

import { formatProgress, preferredTitle } from '@entities/tracker'
import type { TrackerEntry } from '@entities/tracker'

import styles from './PinnedShelf.module.scss'

const SHORTCUT_COVERS = 6
const CONTINUE_ROWS = 3

export interface PinnedShelfProps {
	entries: TrackerEntry[]
	onOpen: (mediaRef: string) => void
	onOpenStatus: (status: string) => void
}

function coversOf(entries: TrackerEntry[]): string[] {
	const covers: string[] = []

	for (const entry of entries) {
		if (entry.media.cover_image) {
			covers.push(entry.media.cover_image)
		}

		if (covers.length === SHORTCUT_COVERS) {
			break
		}
	}

	return covers
}

function Shortcut({
	title,
	hint,
	icon,
	entries,
	onOpen
}: {
	title: string
	hint: string
	icon: 'common/list-checks' | 'common/check'
	entries: TrackerEntry[]
	onOpen: () => void
}) {
	const { t } = useTranslation()
	const covers = coversOf(entries)

	return (
		<button type='button' className={styles.shortcut} onClick={onOpen}>
			<span className={styles.stack} aria-hidden>
				{Array.from({ length: SHORTCUT_COVERS }, (_, slot) => (
					<span key={slot} className={styles.stackItem}>
						{covers[slot] && <img src={covers[slot]} alt='' loading='lazy' draggable={false} />}
					</span>
				))}
			</span>

			<span className={styles.shortcutText}>
				<span className={styles.shortcutCount}>
					<Icon name={icon} size={14} />
					{t('lists.titleCount', { count: entries.length })}
				</span>
				<span className={styles.shortcutTitle}>{title}</span>
				<span className={styles.shortcutHint}>{hint}</span>
			</span>
		</button>
	)
}

export function PinnedShelf({ entries, onOpen, onOpenStatus }: PinnedShelfProps) {
	const { t } = useTranslation()

	const { planning, completed, current } = useMemo(() => {
		const byStatus = (status: string) => entries.filter(entry => entry.status === status)

		return {
			planning: byStatus('PLANNING'),
			completed: byStatus('COMPLETED'),
			current: byStatus('CURRENT')
				.slice()
				.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
		}
	}, [entries])

	return (
		<section className={styles.shelf}>
			<h2 className={styles.heading}>
				<Icon name='common/tag' size={14} />
				{t('lists.pinned')}
			</h2>

			<div className={styles.cards}>
				<Shortcut
					title={t('lists.shortcut.watchlist')}
					hint={t('lists.shortcut.watchlistHint')}
					icon='common/list-checks'
					entries={planning}
					onOpen={() => onOpenStatus('PLANNING')}
				/>

				<Shortcut
					title={t('lists.shortcut.completed')}
					hint={t('lists.shortcut.completedHint')}
					icon='common/check'
					entries={completed}
					onOpen={() => onOpenStatus('COMPLETED')}
				/>

				<div className={styles.continue}>
					<div className={styles.continueHead}>
						<span className={styles.continueTitle}>{t('lists.shortcut.current')}</span>
						<span className={styles.continueCount}>{current.length}</span>

						{current.length > CONTINUE_ROWS && (
							<button
								type='button'
								className={styles.continueAll}
								onClick={() => onOpenStatus('CURRENT')}
							>
								{t('lists.seeAll')}
							</button>
						)}
					</div>

					<ul className={styles.continueList}>
						{current.slice(0, CONTINUE_ROWS).map(entry => {
							const total =
								entry.media_type === 'anime' ? entry.media.episodes : entry.media.chapters
							const title = preferredTitle(entry.media.title)

							return (
								<li key={entry.media_ref}>
									<button
										type='button'
										className={styles.continueRow}
										onClick={() => onOpen(entry.media_ref)}
									>
										<span
											className={styles.continueCover}
											style={{ backgroundColor: entry.media.cover_color ?? undefined }}
										>
											{entry.media.cover_image && (
												<img
													src={entry.media.cover_image}
													alt=''
													loading='lazy'
													draggable={false}
												/>
											)}
										</span>

										<span className={styles.continueBody}>
											<span className={styles.continueName}>{title}</span>
											<ProgressBar
												value={entry.progress}
												max={total}
												label={title}
												className={styles.continueBar}
											/>
										</span>

										<span className={styles.continueProgress}>
											{formatProgress(entry.progress, total)}
										</span>
									</button>
								</li>
							)
						})}

						{current.length === 0 && (
							<li className={styles.continueEmpty}>
								<EmptyState size='small' title={t('lists.empty')} />
							</li>
						)}
					</ul>
				</div>
			</div>
		</section>
	)
}
