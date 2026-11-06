import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Input, toast } from '@shared/ui'

import {
	checkTorrentSourceMutation,
	createTorrentSourceMutation,
	updateTorrentSourceMutation
} from '@entities/torrent'
import type { TorrentSource } from '@entities/torrent'

import styles from './TorznabSourceForm.module.scss'

export interface TorznabSourceFormProps {
	source: TorrentSource | null
	onDone: () => void
}

type CheckState = { ok: true; title: string; search: boolean } | { ok: false; problem: string } | null

export function TorznabSourceForm({ source, onDone }: TorznabSourceFormProps) {
	const { t } = useTranslation()

	const [create, update, check, creating, updating, checking] = useUnit([
		createTorrentSourceMutation.start,
		updateTorrentSourceMutation.start,
		checkTorrentSourceMutation.start,
		createTorrentSourceMutation.$pending,
		updateTorrentSourceMutation.$pending,
		checkTorrentSourceMutation.$pending
	])

	const [name, setName] = useState(source?.name ?? '')
	const [url, setUrl] = useState(source?.url ?? '')
	const [apiKey, setApiKey] = useState('')
	const [result, setResult] = useState<CheckState>(null)

	const submitting = creating || updating
	const canSubmit = name.trim() !== '' && url.trim() !== '' && !submitting

	const keyValue = source && apiKey === '' ? undefined : apiKey

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('torrents.sources.saveFailed')), { id: 'torznab-save-failed' })

	useUnitWatch(createTorrentSourceMutation.finished.success, onDone)
	useUnitWatch(updateTorrentSourceMutation.finished.success, onDone)
	useUnitWatch(createTorrentSourceMutation.finished.failure, failed)
	useUnitWatch(updateTorrentSourceMutation.finished.failure, failed)
	useUnitWatch(checkTorrentSourceMutation.finished.success, ({ result }) =>
		setResult({ ok: true, title: result.title, search: result.search })
	)
	useUnitWatch(checkTorrentSourceMutation.finished.failure, ({ error }) =>
		setResult({ ok: false, problem: problemDetail(error, t('torrents.sources.unreachable')) })
	)

	const runCheck = () => {
		setResult(null)
		check({ source_id: source?.id, url, api_key: keyValue })
	}

	const submit = () => {
		const body = { name, url, api_key: keyValue }

		if (source) {
			update({ id: source.id, body })
		} else {
			create(body)
		}
	}

	const checkMessage = (state: Exclude<CheckState, null>) => {
		if (!state.ok) {
			return state.problem
		}

		const title = state.title || 'Torznab'

		return state.search ? t('torrents.sources.ok', { title }) : t('torrents.sources.noSearch', { title })
	}

	return (
		<form
			className={styles.root}
			onSubmit={event => {
				event.preventDefault()
				submit()
			}}
		>
			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('torrents.sources.nameLabel')}</span>
					<p className={styles.hint}>{t('torrents.sources.nameHint')}</p>
				</div>
				<Input
					value={name}
					onChange={event => setName(event.target.value)}
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
					value={url}
					onChange={event => setUrl(event.target.value)}
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
					value={apiKey}
					onChange={event => setApiKey(event.target.value)}
					disabled={submitting}
					autoComplete='off'
				/>
			</div>

			<div className={styles.footer}>
				<ConnectionCheck
					label={t('torrents.sources.check')}
					size='default'
					checking={checking}
					disabled={url.trim() === '' || submitting}
					onCheck={runCheck}
					status={result && { ok: result.ok && result.search, message: checkMessage(result) }}
				/>

				<div className={styles.formActions}>
					<Button variant='secondary' onClick={onDone} disabled={submitting}>
						{t('common.cancel')}
					</Button>

					<Button type='submit' variant='primary' disabled={!canSubmit} loading={submitting}>
						{source ? t('torrents.sources.save') : t('torrents.sources.create')}
					</Button>
				</div>
			</div>
		</form>
	)
}
