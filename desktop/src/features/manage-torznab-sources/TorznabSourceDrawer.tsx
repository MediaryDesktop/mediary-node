import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, DrawerForm, DrawerSection, Icon, Input, toast } from '@shared/ui'

import {
	checkTorrentSourceMutation,
	createTorrentSourceMutation,
	updateTorrentSourceMutation
} from '@entities/torrent'
import type { TorrentSource } from '@entities/torrent'

import styles from './TorznabSources.module.scss'

export interface TorznabSourceDrawerProps {
	open: boolean
	// The source being changed, or null to add one.
	source: TorrentSource | null
	onClose: () => void
}

type CheckState = { ok: true; title: string; search: boolean } | { ok: false; problem: string } | null

// The form is mounted afresh for every opening, so its fields start from the source.
export function TorznabSourceDrawer({ open, source, onClose }: TorznabSourceDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={source ? t('torrents.sources.editTitle') : t('torrents.sources.createTitle')}
			description={t('torrents.sources.description')}
			closable={false}
		>
			{open && <SourceForm key={source?.id ?? 'new'} source={source} onDone={onClose} />}
		</Drawer>
	)
}

function SourceForm({ source, onDone }: { source: TorrentSource | null; onDone: () => void }) {
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

	// An untouched key field on an existing source keeps the saved key.
	const keyValue = source && apiKey === '' ? undefined : apiKey

	// Only one form is open at a time, so whatever these mutations report is this form's.
	useEffect(() => {
		const failed = ({ error }: { error: { body?: { detail?: string } | null } }) =>
			toast.error(error.body?.detail ?? t('torrents.sources.saveFailed'), { id: 'torznab-save-failed' })

		const stop = [
			createTorrentSourceMutation.finished.success.watch(() => onDone()),
			updateTorrentSourceMutation.finished.success.watch(() => onDone()),
			createTorrentSourceMutation.finished.failure.watch(failed),
			updateTorrentSourceMutation.finished.failure.watch(failed),
			checkTorrentSourceMutation.finished.success.watch(({ result }) =>
				setResult({ ok: true, title: result.title, search: result.search })
			),
			checkTorrentSourceMutation.finished.failure.watch(({ error }) =>
				setResult({ ok: false, problem: error.body?.detail ?? t('torrents.sources.unreachable') })
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [onDone, t])

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
		<DrawerForm
			onSubmit={submit}
			onCancel={onDone}
			submitLabel={source ? t('torrents.sources.save') : t('torrents.sources.create')}
			submitDisabled={!canSubmit}
			cancelDisabled={submitting}
			submitting={submitting}
		>
			<DrawerSection title={t('torrents.sources.nameLabel')}>
				<Input
					value={name}
					onChange={event => setName(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder='Jackett'
				/>
			</DrawerSection>

			<DrawerSection title={t('torrents.sources.urlLabel')} description={t('torrents.sources.urlHint')}>
				<Input
					value={url}
					onChange={event => setUrl(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder='http://localhost:9117/api/v2.0/indexers/all/results/torznab/'
				/>
			</DrawerSection>

			<DrawerSection
				title={t('torrents.sources.keyLabel')}
				description={
					source?.has_api_key ? t('torrents.sources.keyKept') : t('torrents.sources.keyHint')
				}
			>
				<Input
					type='password'
					revealable
					value={apiKey}
					onChange={event => setApiKey(event.target.value)}
					disabled={submitting}
					autoComplete='off'
				/>
			</DrawerSection>

			<div className={styles.check}>
				<Button
					size='small'
					startIcon={<Icon name='common/signal' size={16} />}
					loading={checking}
					disabled={url.trim() === '' || submitting}
					onClick={runCheck}
				>
					{t('torrents.sources.check')}
				</Button>

				{result && (
					<span className={result.ok && result.search ? styles.ok : styles.problem} role='status'>
						{checkMessage(result)}
					</span>
				)}
			</div>
		</DrawerForm>
	)
}
