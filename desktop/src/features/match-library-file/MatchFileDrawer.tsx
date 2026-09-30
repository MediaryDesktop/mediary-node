import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Badge, Drawer, EmptyState, Icon } from '@shared/ui'

import { fileTitle, libraryCandidatesQuery } from '@entities/library-item'
import type { LibrarySuggestion } from '@entities/library-item'

import styles from './MatchFileDrawer.module.scss'
import { matchFileModel } from './model'

function confidenceTone(confidence: number): 'success' | 'warning' | 'neutral' {
	if (confidence >= 0.8) {
		return 'success'
	}

	return confidence >= 0.5 ? 'warning' : 'neutral'
}

export function MatchFileDrawer() {
	const { t } = useTranslation()

	const [open, file, files, applying, closed, confirmed] = useUnit([
		matchFileModel.$open,
		matchFileModel.$file,
		matchFileModel.$files,
		matchFileModel.$applying,
		matchFileModel.closed,
		matchFileModel.confirmed
	])

	const [candidates, pending, error] = useUnit([
		libraryCandidatesQuery.$data,
		libraryCandidatesQuery.$pending,
		libraryCandidatesQuery.$error
	])

	const suggestions: LibrarySuggestion[] = candidates?.suggestions ?? []

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && closed()}
			title={t('library.match.title')}
			description={file ? fileTitle(file) : undefined}
		>
			<div className={styles.content}>
				{files.length > 1 ? (
					<p className={styles.path}>{t('library.match.group', { count: files.length })}</p>
				) : (
					file && <p className={styles.path}>{file.rel_path}</p>
				)}

				{pending && <p className={styles.muted}>{t('library.match.loading')}</p>}

				{error && !pending && <EmptyState title={t('library.match.loadFailed')} />}

				{!pending && !error && suggestions.length === 0 && (
					<EmptyState title={t('library.match.none')} description={t('library.match.noneHint')} />
				)}

				<div className={styles.list}>
					{suggestions.map(suggestion => (
						<button
							key={suggestion.media_ref}
							type='button'
							className={styles.candidate}
							disabled={applying}
							onClick={() => confirmed(suggestion.media_ref)}
						>
							<div className={styles.body}>
								<p className={styles.title}>{suggestion.title}</p>

								<p className={styles.facts}>
									{suggestion.format && <span>{suggestion.format}</span>}
									{suggestion.year !== undefined && <span>{suggestion.year}</span>}
									{suggestion.tracked && <span>{t('library.match.tracked')}</span>}
								</p>
							</div>

							<Badge tone={confidenceTone(suggestion.confidence)}>
								{Math.round(suggestion.confidence * 100)}%
							</Badge>

							<Icon name='common/arrow-right' size={16} className={styles.arrow} />
						</button>
					))}
				</div>
			</div>
		</Drawer>
	)
}
