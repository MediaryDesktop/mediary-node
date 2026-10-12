import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input } from '@shared/ui'

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

const SOURCE = 'anilist'

// A new folder starts with all of it picked and nothing typed: most folders are
// one show, and the last folder's answer is almost never this one's.
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
