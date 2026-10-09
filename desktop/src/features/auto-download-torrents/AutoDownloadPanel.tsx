import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'
import { Button, Disclosure, Icon, Input, Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	checkTorrentRuleMutation,
	deleteTorrentRuleMutation,
	putTorrentRuleMutation,
	torrentRuleQuery,
	TorrentSetupNotice,
	useTorrentSetup
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

	const [data, load, put, saving, nodeReady] = useUnit([
		torrentRuleQuery.$data,
		torrentRuleQuery.start,
		putTorrentRuleMutation.start,
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
				<span className={styles.icon}>
					<IoIosRefresh size={18} />
				</span>
				<div className={styles.text}>
					<h3 className={styles.title}>{t('torrents.auto.panelTitle')}</h3>
					<p className={styles.hint}>{t('torrents.auto.panelHint')}</p>
				</div>
				<Switch
					checked={rule?.enabled ?? false}
					onChange={toggle}
					label={rule?.enabled ? t('torrents.auto.on') : t('torrents.auto.off')}
					disabled={saving}
				/>
			</div>

			{rule && <RuleDetails key={`${rule.from_episode}|${rule.query}`} rule={rule} />}
		</section>
	)
}

function RuleDetails({ rule }: { rule: TorrentRule }) {
	const { t, i18n } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [put, check, remove, saving, checking] = useUnit([
		putTorrentRuleMutation.start,
		checkTorrentRuleMutation.start,
		deleteTorrentRuleMutation.start,
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

	// A missing client or source says it better than the rule's last error, which
	// is that same thing in the node's words.
	const setupMissing =
		setup.loaded && (!setup.clientConfigured || setup.clientReachable === false || !setup.hasSources)

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
		<div className={styles.details}>
			<TorrentSetupNotice
				setup={setup}
				needSearch
				onOpenSettings={missing =>
					navigate({
						to: '/settings',
						search: { section: missing === 'client' ? 'torrent-client' : 'torrent-search' }
					})
				}
			/>

			<p className={styles.status}>
				{t('torrents.auto.fromShort', { episode: rule.from_episode })}
				{rule.last_checked && (
					<>
						{' · '}
						{t('torrents.auto.lastChecked', {
							when: formatRelativeTime(rule.last_checked, i18n.language),
							count: rule.last_added
						})}
					</>
				)}
			</p>

			{rule.last_error && !setupMissing && <p className={styles.problem}>{rule.last_error}</p>}

			<div className={styles.actions}>
				<Button
					size='small'
					variant='secondary'
					startIcon={<Icon name='common/eye' size={14} />}
					loading={checking && lastPreview}
					disabled={checking || dirty || setupMissing}
					onClick={() => run(true)}
				>
					{t('torrents.auto.preview')}
				</Button>
				<Button
					size='small'
					variant='secondary'
					startIcon={<Icon name='common/download' size={14} />}
					loading={checking && !lastPreview}
					disabled={checking || dirty || setupMissing}
					onClick={() => run(false)}
				>
					{t('torrents.auto.checkNow')}
				</Button>
				<Button
					size='small'
					variant='ghost'
					startIcon={<Icon name='common/trash' size={14} />}
					className={styles.remove}
					onClick={() => remove(rule.media_ref)}
				>
					{t('torrents.auto.remove')}
				</Button>
			</div>

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

			<Disclosure summary={t('torrents.auto.settings')} className={styles.settings}>
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
				<Button
					size='small'
					loading={saving}
					disabled={!dirty}
					onClick={save}
					className={styles.save}
				>
					{t('torrents.auto.save')}
				</Button>
			</Disclosure>
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
