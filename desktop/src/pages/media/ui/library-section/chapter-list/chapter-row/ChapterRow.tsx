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
	icons: Map<string, string>
	// Absent when the chapter cannot be saved, so there is nothing to select.
	selected?: boolean
	onSelect: (selected: boolean) => void
	onOpen: (option: ChapterOption) => void
	onSave?: () => void
}

function StateBadge({ state }: { state: ChapterState }) {
	const { t } = useTranslation()

	switch (state.kind) {
		case 'saving':
			return (
				<Badge tone='info' icon='common/download'>
					{state.total > 0
						? t('mangaSources.downloads.progress', { done: state.done, total: state.total })
						: t('mangaSources.downloads.states.running')}
				</Badge>
			)
		case 'queued':
			return <Badge>{t('mangaSources.downloads.states.queued')}</Badge>
		case 'read':
			return (
				<Badge tone='success' icon='common/check'>
					{t('mangaSources.chapters.status.read')}
				</Badge>
			)
		case 'saved':
			return (
				<Badge tone='accent' icon='common/folder'>
					{t('mangaSources.chapters.status.saved')}
				</Badge>
			)
		default:
			return <Badge>{t('mangaSources.chapters.status.online')}</Badge>
	}
}

// A chapter opens its nearest copy; the other copies wait behind the menu.
export function ChapterRow({ row, state, icons, selected, onSelect, onOpen, onSave }: ChapterRowProps) {
	const { t } = useTranslation()
	const [first, ...others] = row.options

	if (!first) {
		return null
	}

	const label = row.number === null ? first.title : t('reader.chapterNumber', { number: row.number })
	// The file name says more of a library copy than a title that repeats the number.
	const subtitle = first.title !== label ? first.title : first.source === LOCAL_SOURCE ? first.detail : ''

	return (
		<div
			role='row'
			className={clsx(styles.row, state.kind === 'read' && styles.read, selected && styles.selected)}
		>
			<span role='cell' className={styles.check}>
				{selected !== undefined && (
					<Checkbox
						checked={selected}
						onCheckedChange={onSelect}
						label={t('mangaSources.chapters.select', { label })}
					/>
				)}
			</span>

			<span role='cell' className={styles.chapter}>
				<button type='button' className={styles.open} onClick={() => onOpen(first)}>
					<span className={styles.number}>{label}</span>
					{subtitle && <span className={styles.subtitle}>{subtitle}</span>}
				</button>
			</span>

			<span role='cell' className={styles.source}>
				<SourceIcon source={first.source} name={first.sourceName} image={icons.get(first.source)} />
				<span className={styles.sourceText}>
					<span className={styles.sourceName}>{first.sourceName}</span>
					{first.groups && first.groups.length > 0 && (
						<span className={styles.groups}>{first.groups.join(', ')}</span>
					)}
				</span>
				{others.length > 0 && (
					<span className={styles.more} title={others.map(option => option.sourceName).join(', ')}>
						+{others.length}
					</span>
				)}
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
				<RippleButton
					className={styles.action}
					aria-label={t('mangaSources.chapters.open', { label })}
					title={t('reader.read')}
					onClick={() => onOpen(first)}
				>
					<Icon name={first.externalUrl ? 'common/external-link' : 'common/book-open'} size={16} />
				</RippleButton>

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
