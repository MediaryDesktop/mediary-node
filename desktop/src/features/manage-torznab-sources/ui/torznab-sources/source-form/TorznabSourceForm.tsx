import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, ConnectionCheck, Input } from '@shared/ui'

import { sourceEditor } from '../../../model/editor'
import type { SourceCheck } from '../../../model/editor'

import styles from './TorznabSourceForm.module.scss'

export function TorznabSourceForm() {
	const { t } = useTranslation()

	const { editing, fields, result, checking, canSubmit, submitting } = useUnit({
		editing: sourceEditor.$editing,
		fields: sourceEditor.$fields,
		result: sourceEditor.$check,
		checking: sourceEditor.$checking,
		canSubmit: sourceEditor.$canSubmit,
		submitting: sourceEditor.$submitting
	})
	const { changed, checked, submitted, closed } = useUnit({
		changed: sourceEditor.changed,
		checked: sourceEditor.checked,
		submitted: sourceEditor.submitted,
		closed: sourceEditor.closed
	})

	const source = editing?.item ?? null

	const checkMessage = (state: SourceCheck) => {
		if (!state.ok) {
			return problemDetail(state.error, t('torrents.sources.unreachable'))
		}

		const title = state.title || 'Torznab'

		return state.search ? t('torrents.sources.ok', { title }) : t('torrents.sources.noSearch', { title })
	}

	return (
		<form
			className={styles.root}
			onSubmit={event => {
				event.preventDefault()
				submitted()
			}}
		>
			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('torrents.sources.nameLabel')}</span>
					<p className={styles.hint}>{t('torrents.sources.nameHint')}</p>
				</div>
				<Input
					value={fields.name}
					onChange={event => changed({ name: event.target.value })}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder='Jackett'
				/>
			</label>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('torrents.sources.urlLabel')}</span>
					<p className={styles.hint}>{t('torrents.sources.urlHint')}</p>
				</div>
				<Input
					value={fields.url}
					onChange={event => changed({ url: event.target.value })}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder='http://localhost:9117/api/v2.0/indexers/all/results/torznab/'
				/>
			</div>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('torrents.sources.keyLabel')}</span>
					<p className={styles.hint}>
						{source?.has_api_key ? t('torrents.sources.keyKept') : t('torrents.sources.keyHint')}
					</p>
				</div>
				<Input
					type='password'
					revealable
					value={fields.apiKey}
					onChange={event => changed({ apiKey: event.target.value })}
					disabled={submitting}
					autoComplete='off'
				/>
			</div>

			<div className={styles.footer}>
				<ConnectionCheck
					label={t('torrents.sources.check')}
					size='default'
					checking={checking}
					disabled={fields.url.trim() === '' || submitting}
					onCheck={() => checked()}
					status={result && { ok: result.ok && result.search, message: checkMessage(result) }}
				/>

				<div className={styles.formActions}>
					<Button variant='secondary' onClick={() => closed()} disabled={submitting}>
						{t('common.cancel')}
					</Button>

					<Button
						type='submit'
						variant='primary'
						disabled={!canSubmit || submitting}
						loading={submitting}
					>
						{source ? t('torrents.sources.save') : t('torrents.sources.create')}
					</Button>
				</div>
			</div>
		</form>
	)
}
