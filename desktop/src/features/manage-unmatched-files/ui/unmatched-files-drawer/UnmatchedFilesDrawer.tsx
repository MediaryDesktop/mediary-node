import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, EmptyState, Icon, Input, useRipple } from '@shared/ui'

import {
	fileName,
	libraryCandidatesQuery,
	libraryTreeQuery,
	setLibraryFilesIgnoredMutation,
	setLibraryMatchesMutation
} from '@entities/library-item'
import type { LibrarySuggestion } from '@entities/library-item'

import { CheckRow } from '../check-row/CheckRow'
import { unmatchedGroups } from '../../lib/groups'
import type { UnmatchedGroup } from '../../lib/groups'
import { unmatchedFilesModel } from '../../model/model'
import styles from './UnmatchedFilesDrawer.module.scss'

const SOURCE = 'anilist'

// The design works through unmatched files a folder at a time: a page per
// folder, every file on it picked by default, one title applied to the pick.
export function UnmatchedFilesDrawer() {
	const { t } = useTranslation()

	const [open, closed] = useUnit([unmatchedFilesModel.$unmatchedOpen, unmatchedFilesModel.unmatchedClosed])
	const [treeData, startTree] = useUnit([libraryTreeQuery.$data, libraryTreeQuery.start])

	const [page, setPage] = useState(0)

	useEffect(() => {
		if (open) {
			startTree()
		}
	}, [open, startTree])

	const groups = useMemo(() => unmatchedGroups(treeData?.files.items ?? []), [treeData])

	const lastPage = Math.max(groups.length - 1, 0)
	const shown = Math.min(page, lastPage)
	const current = groups[shown] ?? null

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && closed()}
			title={t('library.unmatched.title')}
			size='xl'
			closable={false}
		>
			{current === null ? (
				<EmptyState title={t('library.unmatched.empty')} />
			) : (
				<div className={styles.body}>
					{groups.length > 1 && (
						<div className={styles.pager}>
							<Button
								variant='secondary'
								startIcon={<Icon name='common/arrow-left' size={16} />}
								disabled={shown === 0}
								onClick={() => setPage(shown - 1)}
							>
								{t('library.unmatched.previous')}
							</Button>

							<p className={styles.count}>
								{shown + 1} / {lastPage + 1}
							</p>

							<Button
								variant='secondary'
								endIcon={<Icon name='common/arrow-right' size={16} />}
								disabled={shown >= lastPage}
								onClick={() => setPage(shown + 1)}
							>
								{t('library.unmatched.next')}
							</Button>
						</div>
					)}

					{/* Keyed by folder, so a new page starts from its own defaults. */}
					<GroupPage key={current.key} group={current} />
				</div>
			)}
		</Drawer>
	)
}

// A new folder starts with all of it picked and nothing typed: most folders are
// one show, and the last folder's answer is almost never this one's.
function GroupPage({ group }: { group: UnmatchedGroup }) {
	const { t } = useTranslation()

	const [candidates, suggesting, startSuggestions] = useUnit([
		libraryCandidatesQuery.$data,
		libraryCandidatesQuery.$pending,
		libraryCandidatesQuery.start
	])

	const [matchFiles, matching, ignoreFiles, ignoring] = useUnit([
		setLibraryMatchesMutation.start,
		setLibraryMatchesMutation.$pending,
		setLibraryFilesIgnoredMutation.start,
		setLibraryFilesIgnoredMutation.$pending
	])

	const [selected, setSelected] = useState<Set<number>>(() => new Set(group.files.map(file => file.id)))
	const [mediaId, setMediaId] = useState('')
	const [asked, setAsked] = useState(false)

	const picked = group.files.filter(file => selected.has(file.id))
	const busy = matching || ignoring

	const suggestions: LibrarySuggestion[] = asked ? (candidates?.suggestions ?? []) : []

	const allState = picked.length === 0 ? false : picked.length === group.files.length ? true : 'mixed'

	const toggle = (id: number, checked: boolean) =>
		setSelected(current => {
			const next = new Set(current)

			if (checked) {
				next.add(id)
			} else {
				next.delete(id)
			}

			return next
		})

	return (
		<>
			<div className={styles.folder}>
				<Icon name='common/folder' size={20} />
				<span>{group.folder}</span>
			</div>

			<div className={styles.idRow}>
				<p className={styles.idLabel}>{t('library.unmatched.sourceId')}</p>

				<Input
					value={mediaId}
					inputMode='numeric'
					onChange={event => setMediaId(event.target.value.replace(/\D/g, ''))}
					className={styles.idInput}
				/>

				<Button
					variant='primary'
					disabled={mediaId === '' || picked.length === 0 || busy}
					loading={matching}
					onClick={() =>
						matchFiles(
							picked.map(file => ({
								fileId: file.id,
								mediaRef: `${SOURCE}:${mediaId}`,
								season: file.parsed.season ?? undefined,
								episode: file.parsed.episode ?? file.parsed.chapter ?? undefined
							}))
						)
					}
				>
					{t('library.unmatched.matchSelection')}
				</Button>
			</div>

			<div className={styles.files}>
				<CheckRow
					checked={allState}
					label={t('library.unmatched.selectAll')}
					onCheckedChange={checked =>
						setSelected(new Set(checked ? group.files.map(file => file.id) : []))
					}
				/>

				{group.files.map(file => (
					<CheckRow
						key={file.id}
						checked={selected.has(file.id)}
						label={fileName(file)}
						onCheckedChange={checked => toggle(file.id, checked)}
					/>
				))}
			</div>

			<div className={styles.actions}>
				<Button
					variant='ghost'
					startIcon={<Icon name='common/search' size={16} />}
					disabled={picked.length === 0}
					onClick={() => {
						const first = picked[0]

						if (first) {
							setAsked(true)
							startSuggestions(first.id)
						}
					}}
				>
					{t('library.unmatched.fetchSuggestions')}
				</Button>

				<span className={styles.spacer} />

				<Button
					variant='secondary'
					size='small'
					startIcon={<Icon name='common/eye-off' size={14} />}
					className={styles.ignore}
					disabled={picked.length === 0 || busy}
					loading={ignoring}
					onClick={() => ignoreFiles(picked.map(file => ({ fileId: file.id, ignored: true })))}
				>
					{t('library.unmatched.ignoreSelection')}
				</Button>
			</div>

			{asked && suggesting && <p className={styles.muted}>{t('library.match.loading')}</p>}

			{asked && !suggesting && suggestions.length === 0 && (
				<p className={styles.muted}>{t('library.match.none')}</p>
			)}

			{suggestions.length > 0 && (
				<section className={styles.suggestions}>
					<h3 className={styles.heading}>{t('library.unmatched.pickTitle')}</h3>

					<div className={styles.grid} role='radiogroup'>
						{suggestions.map(suggestion => {
							const id = suggestion.media_ref.split(':')[1] ?? ''
							const chosen = mediaId !== '' && id === mediaId

							return (
								<SuggestionCard
									key={suggestion.media_ref}
									suggestion={suggestion}
									chosen={chosen}
									onClick={() => setMediaId(id)}
								/>
							)
						})}
					</div>
				</section>
			)}
		</>
	)
}

interface SuggestionCardProps {
	suggestion: LibrarySuggestion
	chosen: boolean
	onClick: () => void
}

function SuggestionCard({ suggestion, chosen, onClick }: SuggestionCardProps) {
	const { t } = useTranslation()
	const ripple = useRipple<HTMLButtonElement>()

	return (
		<button
			ref={ripple}
			type='button'
			role='radio'
			aria-checked={chosen}
			className={clsx(styles.card, chosen && styles.chosen)}
			onClick={onClick}
		>
			<span className={styles.poster} style={{ backgroundColor: suggestion.cover_color ?? undefined }}>
				{suggestion.cover_image && <img src={suggestion.cover_image} alt='' loading='lazy' />}
			</span>

			<span className={styles.cardText}>
				<span className={styles.cardTitle}>{suggestion.title}</span>

				<span className={styles.cardMeta}>
					{[
						suggestion.format,
						suggestion.year ? String(suggestion.year) : null,
						t('library.unmatched.confidence', {
							percent: Math.round(suggestion.confidence * 100)
						})
					]
						.filter(Boolean)
						.join(' · ')}
				</span>
			</span>

			{suggestion.tracked && (
				<span className={styles.tracked}>
					<Icon name='common/list' size={12} />
					{t('library.unmatched.onYourList')}
				</span>
			)}
		</button>
	)
}
