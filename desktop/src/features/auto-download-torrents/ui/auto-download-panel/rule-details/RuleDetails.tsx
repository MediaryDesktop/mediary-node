import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, useUnitWatch } from '@shared/lib'
import { Button, Disclosure, Icon, Input, toast } from '@shared/ui'

import {
	checkTorrentRuleMutation,
	deleteTorrentRuleMutation,
	putTorrentRuleMutation,
	TorrentSetupNotice,
	useTorrentSetup
} from '@entities/torrent'
import type { TorrentRule, TorrentRuleCheck } from '@entities/torrent'

import { CheckResult } from './check-result/CheckResult'
import styles from './RuleDetails.module.scss'

// An existing rule: when it last looked, a check to run now, and its settings.
export function RuleDetails({ rule }: { rule: TorrentRule }) {
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

	useUnitWatch(checkTorrentRuleMutation.finished.success, ({ params, result: check }) =>
		setResult({ check, preview: params.preview })
	)
	useUnitWatch(checkTorrentRuleMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.auto.checkFailed')), {
			id: 'torrent-rule-check'
		})
	)

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

			{result && <CheckResult check={result.check} preview={result.preview} />}

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
