import { useUnit } from 'effector-react'
import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'
import { Button, Icon, Input, Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	checkTorrentRuleMutation,
	deleteTorrentRuleMutation,
	putTorrentRuleMutation,
	torrentRuleQuery
} from '@entities/torrent'
import type { TorrentRule, TorrentRuleCheck } from '@entities/torrent'

import styles from './AutoDownloadPanel.module.scss'

export interface AutoDownloadPanelProps {
	mediaRef: string
	// The title's name; it also names the folder downloads go into.
	title: string
}

type Failure = { error: { body?: { detail?: string } | null } }

// A title's new episodes, downloaded by the node on its own: the switch makes
// the rule, the rest tunes it. The node looks every 30 minutes.
export function AutoDownloadPanel({ mediaRef, title }: AutoDownloadPanelProps) {
	const { t } = useTranslation()

	const [data, load, put, remove, saving, nodeReady] = useUnit([
		torrentRuleQuery.$data,
		torrentRuleQuery.start,
		putTorrentRuleMutation.start,
		deleteTorrentRuleMutation.start,
		putTorrentRuleMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load(mediaRef)
		}
	}, [load, mediaRef, nodeReady])

	useEffect(() => {
		const failed = ({ error }: Failure) =>
			toast.error(error.body?.detail ?? t('torrents.auto.saveFailed'), { id: 'torrent-rule' })

		const stop = [
			putTorrentRuleMutation.finished.failure.watch(failed),
			deleteTorrentRuleMutation.finished.failure.watch(failed)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	// The query is shared by every title page; an answer for another title is not
	// this one's.
	const rule = data?.rule?.media_ref === mediaRef ? data.rule : null

	const toggle = (enabled: boolean) => {
		if (rule) {
			put({
				mediaRef,
				body: { title: rule.title, query: rule.query, from_episode: rule.from_episode, enabled }
			})
		} else if (enabled) {
			put({ mediaRef, body: { title, enabled: true } })
		}
	}

	return (
		<section className={styles.root}>
			<div className={styles.head}>
				<Switch
					checked={rule?.enabled ?? false}
					onChange={toggle}
					label={t('torrents.auto.enable')}
					disabled={saving}
				/>
				{rule && (
					<Button
						size='small'
						variant='ghost'
						startIcon={<Icon name='common/trash' size={14} />}
						onClick={() => remove(mediaRef)}
					>
						{t('torrents.auto.remove')}
					</Button>
				)}
			</div>

			<p className={styles.hint}>{t('torrents.auto.hint')}</p>

			{rule && <RuleForm key={`${rule.from_episode}|${rule.query}`} rule={rule} />}
		</section>
	)
}

function RuleForm({ rule }: { rule: TorrentRule }) {
	const { t, i18n } = useTranslation()

	const [put, check, saving, checking] = useUnit([
		putTorrentRuleMutation.start,
		checkTorrentRuleMutation.start,
		putTorrentRuleMutation.$pending,
		checkTorrentRuleMutation.$pending
	])

	const [from, setFrom] = useState(String(rule.from_episode))
	const [query, setQuery] = useState(rule.query)
	const [result, setResult] = useState<{ check: TorrentRuleCheck; preview: boolean } | null>(null)
	const [lastPreview, setLastPreview] = useState(false)

	useEffect(() => {
		const stop = [
			checkTorrentRuleMutation.finished.success.watch(({ params, result: check }) =>
				setResult({ check, preview: params.preview })
			),
			checkTorrentRuleMutation.finished.failure.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('torrents.auto.checkFailed'), {
					id: 'torrent-rule-check'
				})
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	const dirty = from !== String(rule.from_episode) || query.trim() !== rule.query

	const save = () =>
		put({
			mediaRef: rule.media_ref,
			body: {
				title: rule.title,
				query: query.trim(),
				from_episode: Math.max(1, Number(from) || 1),
				enabled: rule.enabled
			}
		})

	const run = (preview: boolean) => {
		setResult(null)
		setLastPreview(preview)
		check({ mediaRef: rule.media_ref, preview })
	}

	const planned = result?.check.planned ?? []
	// A batch brings several episodes in one torrent; people count episodes.
	const episodeCount = planned.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0)
	const addedCount =
		result && result.check.added === planned.length ? episodeCount : (result?.check.added ?? 0)

	return (
		<div className={styles.form}>
			<div className={styles.fields}>
				<label className={styles.field}>
					{t('torrents.auto.from')}
					<Input
						type='number'
						min={1}
						value={from}
						onChange={event => setFrom(event.target.value)}
						disabled={saving}
					/>
				</label>
				<label className={styles.field}>
					{t('torrents.auto.query')}
					<Input
						value={query}
						onChange={event => setQuery(event.target.value)}
						disabled={saving}
						spellCheck={false}
						placeholder={t('torrents.auto.queryPlaceholder')}
					/>
				</label>
			</div>

			<div className={styles.actions}>
				{dirty && (
					<Button size='small' loading={saving} onClick={save}>
						{t('torrents.auto.save')}
					</Button>
				)}
				<Button
					size='small'
					variant='ghost'
					startIcon={<Icon name='common/eye' size={14} />}
					loading={checking && lastPreview}
					disabled={checking || dirty}
					onClick={() => run(true)}
				>
					{t('torrents.auto.preview')}
				</Button>
				<Button
					size='small'
					variant='ghost'
					startIcon={<Icon name='common/download' size={14} />}
					loading={checking && !lastPreview}
					disabled={checking || dirty}
					onClick={() => run(false)}
				>
					{t('torrents.auto.checkNow')}
				</Button>
			</div>

			{rule.last_checked && (
				<p className={styles.status}>
					{t('torrents.auto.lastChecked', {
						when: formatRelativeTime(rule.last_checked, i18n.language),
						count: rule.last_added
					})}
				</p>
			)}
			{rule.last_error && <p className={styles.problem}>{rule.last_error}</p>}

			{result && (
				<div className={styles.result}>
					<p className={styles.status}>
						{planned.length === 0
							? t('torrents.auto.nothing')
							: result.preview
								? t('torrents.auto.wouldAdd', { count: episodeCount })
								: t('torrents.auto.added', { count: addedCount })}
					</p>
					{result.check.error && <p className={styles.problem}>{result.check.error}</p>}
					{planned.length > 0 && (
						<ul className={styles.planned}>
							{planned.map(item => (
								<li key={item.release.id}>
									<span className={styles.episode}>
										{episodeLabel(item.episodes ?? [], t)}
									</span>
									<span className={styles.release} title={item.release.title}>
										{item.release.title}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

// "Ep. 3", or "Ep. 5–28" for a batch's run of episodes.
function episodeLabel(episodes: number[], t: TFunction): string {
	const first = episodes[0] ?? 0
	const last = episodes[episodes.length - 1] ?? first

	if (first === last) {
		return t('torrents.files.episode', { number: first })
	}

	const contiguous = last - first + 1 === episodes.length

	return contiguous
		? t('torrents.search.episodes', { from: first, to: last })
		: episodes.map(episode => t('torrents.files.episode', { number: episode })).join(', ')
}
