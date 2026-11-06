import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { Badge, Checkbox, DropdownMenu, Icon, RippleButton } from '@shared/ui'

import { LOCAL_SOURCE } from '@entities/reader'
import type { ChapterOption, ChapterRow as Row } from '@entities/reader'

import type { ChapterState } from '../lib/chapters'
import { SourceIcon } from '../source-icon/SourceIcon'

import styles from './ChapterRow.module.scss'

export interface ChapterRowProps {
	row: Row
	state: ChapterState
	read: boolean
	icons: Map<string, string>
	selected?: boolean
	onSelect: (selected: boolean) => void
	onOpen: (option: ChapterOption) => void
	onSave?: () => void
	onToggleRead?: () => void
}

function StateBadge({ state }: { state: ChapterState }) {
	const { t } = useTranslation()

	switch (state.kind) {
		case 'saving':
			return (
				<Badge tone='info' size='md' icon='common/download'>
					{state.total > 0
						? t('mangaSources.downloads.progress', { done: state.done, total: state.total })
						: t('mangaSources.downloads.states.running')}
				</Badge>
			)
		case 'queued':
			return <Badge size='md'>{t('mangaSources.downloads.states.queued')}</Badge>
		case 'read':
			return (
				<Badge tone='success' size='md'>
					{t('mangaSources.chapters.status.read')}
				</Badge>
			)
		case 'saved':
			return (
				<Badge tone='accent' size='md'>
					{t('mangaSources.chapters.status.saved')}
				</Badge>
			)
		default:
			return <Badge size='md'>{t('mangaSources.chapters.status.online')}</Badge>
	}
}

export function ChapterRow({
	row,
	state,
	read,
	icons,
	selected,
	onSelect,
	onOpen,
	onSave,
	onToggleRead
}: ChapterRowProps) {
	const { t } = useTranslation()
	const [first, ...others] = row.options

	if (!first) {
		return null
	}

	const label = row.number === null ? first.title : t('reader.chapterNumber', { number: row.number })
	const subtitle = first.title !== label ? first.title : first.source === LOCAL_SOURCE ? first.detail : ''
	const readLabel = t(read ? 'mangaSources.chapters.markUnread' : 'mangaSources.chapters.markRead', { label })

	return (
		<div role='row' className={clsx(styles.row, read && styles.read, selected && styles.selected)}>
			<span role='cell' className={styles.chapter}>
				{selected !== undefined && (
					<Checkbox
						checked={selected}
						onCheckedChange={onSelect}
						label={t('mangaSources.chapters.select', { label })}
					/>
				)}

				<button type='button' className={styles.open} onClick={() => onOpen(first)}>
					<span className={styles.number}>{label}</span>
					{subtitle && <span className={styles.subtitle}>{subtitle}</span>}
				</button>
			</span>

			<span role='cell' className={styles.source}>
				<SourceIcon source={first.source} name={first.sourceName} image={icons.get(first.source)} />
				<span className={styles.sourceText}>
					<span className={styles.sourceName}>{first.sourceName}</span>
				</span>
			</span>

			<span role='cell' className={styles.language}>
				{first.language ? first.language.toUpperCase() : '—'}
			</span>

			<span role='cell' className={styles.pages}>
				{first.pages ? first.pages : '—'}
			</span>

			<span role='cell' className={styles.state}>
				<StateBadge state={state} />
			</span>

			<span role='cell' className={styles.actions}>
				{onToggleRead && (
					<RippleButton
						className={clsx(styles.action, read && styles.on)}
						aria-pressed={read}
						aria-label={readLabel}
						title={readLabel}
						onClick={onToggleRead}
					>
						<Icon name='common/check' size={16} />
					</RippleButton>
				)}

				{onSave && (
					<RippleButton
						className={styles.action}
						aria-label={t('mangaSources.downloads.save')}
						title={t('mangaSources.downloads.save')}
						onClick={onSave}
					>
						<Icon name='common/download' size={16} />
					</RippleButton>
				)}

				{others.length > 0 && (
					<DropdownMenu
						items={others.map(option => ({
							id: option.ref,
							label: `${option.sourceName} · ${option.detail}`,
							icon: (
								<SourceIcon
									source={option.source}
									name={option.sourceName}
									image={icons.get(option.source)}
								/>
							),
							onSelect: () => onOpen(option)
						}))}
						trigger={
							<RippleButton
								className={styles.action}
								aria-label={t('mangaSources.chapters.copies')}
								title={t('mangaSources.chapters.copies')}
							>
								<Icon name='common/more-vertical' size={16} />
							</RippleButton>
						}
					/>
				)}
			</span>
		</div>
	)
}
