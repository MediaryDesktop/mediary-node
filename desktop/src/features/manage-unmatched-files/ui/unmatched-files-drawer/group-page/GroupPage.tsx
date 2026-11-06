import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, ReelLoader } from '@shared/ui'

import {
	fileName,
	libraryCandidatesQuery,
	setLibraryFilesIgnoredMutation,
	setLibraryMatchesMutation
} from '@entities/library-item'
import type { LibrarySuggestion } from '@entities/library-item'

import type { UnmatchedGroup } from '../../../lib/groups'
import { CheckRow } from '../../check-row/CheckRow'

import styles from './GroupPage.module.scss'
import { SuggestionCard } from './suggestion-card/SuggestionCard'

const ANILIST = 'anilist:'

export function GroupPage({ group }: { group: UnmatchedGroup }) {
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
	const [mediaRef, setMediaRef] = useState('')
	const [asked, setAsked] = useState(false)

	const picked = group.files.filter(file => selected.has(file.id))
	const busy = matching || ignoring

	const suggestions: LibrarySuggestion[] = asked && !suggesting ? (candidates?.suggestions ?? []) : []

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

			{group.typedId && (
				<div className={styles.idRow}>
					<p className={styles.idLabel}>{t('library.unmatched.sourceId')}</p>

					<Input
						value={mediaRef.startsWith(ANILIST) ? mediaRef.slice(ANILIST.length) : ''}
						inputMode='numeric'
						onChange={event => {
							const id = event.target.value.replace(/\D/g, '')
							setMediaRef(id === '' ? '' : `${ANILIST}${id}`)
						}}
						className={styles.idInput}
					/>
				</div>
			)}

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

				<Button
					variant='primary'
					disabled={mediaRef === '' || picked.length === 0 || busy}
					loading={matching}
					onClick={() =>
						matchFiles(
							picked.map(file => ({
								fileId: file.id,
								mediaRef,
								season: file.parsed.season ?? undefined,
								episode: file.parsed.episode ?? file.parsed.chapter ?? undefined
							}))
						)
					}
				>
					{t('library.unmatched.matchSelection')}
				</Button>
			</div>

			{asked && suggesting && (
				<div className={styles.loading}>
					<ReelLoader spinning />
				</div>
			)}

			{asked && !suggesting && suggestions.length === 0 && (
				<p className={styles.muted}>{t('library.match.none')}</p>
			)}

			{suggestions.length > 0 && (
				<section className={styles.suggestions}>
					<h3 className={styles.heading}>{t('library.unmatched.pickTitle')}</h3>

					<div className={styles.grid} role='radiogroup'>
						{suggestions.map(suggestion => (
							<SuggestionCard
								key={suggestion.media_ref}
								suggestion={suggestion}
								chosen={suggestion.media_ref === mediaRef}
								onClick={() => setMediaRef(suggestion.media_ref)}
							/>
						))}
					</div>
				</section>
			)}
		</>
	)
}
