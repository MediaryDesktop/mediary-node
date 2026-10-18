import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { FaSliders } from 'react-icons/fa6'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, readStored, useUnitWatch, writeStored } from '@shared/lib'
import { Button, CollapsibleSection, Icon, Input, RippleButton, Stepper, toast } from '@shared/ui'

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
import { Status } from './status/Status'

const SETTINGS_OPEN_KEY = 'mediary.autoDownload.settingsOpen'

// An existing rule: where it stands, a check to run now, and its settings.
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

	const [from, setFrom] = useState(rule.from_episode)
	const [query, setQuery] = useState(rule.query)
	const [result, setResult] = useState<{ check: TorrentRuleCheck; preview: boolean } | null>(null)
	const [lastPreview, setLastPreview] = useState(false)
	const [settingsOpen, setSettingsOpen] = useState(() => readStored(SETTINGS_OPEN_KEY) === 'on')

	useUnitWatch(checkTorrentRuleMutation.finished.success, ({ params, result: check }) =>
		setResult({ check, preview: params.preview })
	)
	useUnitWatch(checkTorrentRuleMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.auto.checkFailed')), {
			id: 'torrent-rule-check'
		})
	)

	const dirty = from !== rule.from_episode || query.trim() !== rule.query

	// A missing client or source says it better than the rule's last error, which
	// is that same thing in the node's words.
	const setupMissing =
		setup.loaded && (!setup.clientConfigured || setup.clientReachable === false || !setup.hasSources)

	const toggleSettings = () => {
		setSettingsOpen(on => {
			writeStored(SETTINGS_OPEN_KEY, on ? 'off' : 'on')
			return !on
		})
	}

	const save = () =>
		put({
			mediaRef: rule.media_ref,
			body: {
				title: rule.title,
				query: query.trim(),
				from_episode: Math.max(1, from),
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
			<div className={styles.overview}>
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

				<dl className={styles.stats}>
					<div className={styles.stat}>
						<dt>{t('torrents.auto.stats.lastCheck')}</dt>
						<dd>
							{rule.last_checked
								? formatRelativeTime(rule.last_checked, i18n.language)
								: t('torrents.auto.stats.never')}
						</dd>
					</div>
					<div className={styles.stat}>
						<dt>{t('torrents.auto.stats.startsFrom')}</dt>
						<dd>{t('torrents.auto.stats.episode', { episode: rule.from_episode })}</dd>
					</div>
					<div className={styles.stat}>
						<dt>{t('torrents.auto.stats.lastAdded')}</dt>
						<dd>{t('torrents.auto.stats.downloads', { count: rule.last_added })}</dd>
					</div>
				</dl>

				<div className={styles.actions}>
					<Button
						variant='primary'
						startIcon={<IoIosRefresh size={16} />}
						loading={checking && !lastPreview}
						disabled={checking || dirty || setupMissing}
						onClick={() => run(false)}
					>
						{t('torrents.auto.checkNow')}
					</Button>
					<Button
						startIcon={<Icon name='common/eye' size={16} />}
						loading={checking && lastPreview}
						disabled={checking || dirty || setupMissing}
						onClick={() => run(true)}
					>
						{t('torrents.auto.preview')}
					</Button>
					<Button
						variant='ghost'
						startIcon={<Icon name='common/trash' size={16} />}
						className={styles.remove}
						onClick={() => remove(rule.media_ref)}
					>
						{t('torrents.auto.remove')}
					</Button>
				</div>

				{result ? (
					<CheckResult check={result.check} preview={result.preview} />
				) : (
					<RuleStatus rule={rule} setupMissing={setupMissing} />
				)}
			</div>

			<div className={styles.settings}>
				<RippleButton
					className={styles.settingsHead}
					aria-expanded={settingsOpen}
					aria-controls={`rule-settings-${rule.media_ref}`}
					onClick={toggleSettings}
				>
					<FaSliders size={18} className={styles.settingsIcon} />
					<span className={styles.settingsTitle}>{t('torrents.auto.settings')}</span>
					<span className={clsx(styles.chevron, settingsOpen && styles.chevronOpen)} aria-hidden>
						<Icon name='common/chevron-down' size={18} />
					</span>
				</RippleButton>

				<CollapsibleSection open={settingsOpen}>
					<div id={`rule-settings-${rule.media_ref}`} className={styles.settingsBody}>
						<div className={styles.fields}>
							<div className={styles.field}>
								<span className={styles.label}>{t('torrents.auto.from')}</span>
								<Stepper
									className={styles.stepper}
									disabled={saving}
									decrementDisabled={from <= 1}
									onDecrement={() => setFrom(value => Math.max(1, value - 1))}
									onIncrement={() => setFrom(value => value + 1)}
									value={
										<input
											type='number'
											min={1}
											className={styles.stepperInput}
											aria-label={t('torrents.auto.from')}
											value={from}
											disabled={saving}
											onChange={event =>
												setFrom(Math.max(1, Number(event.target.value) || 1))
											}
										/>
									}
								/>
								<span className={styles.fieldHint}>{t('torrents.auto.fromHint')}</span>
							</div>

							<label className={styles.field}>
								<span className={styles.label}>{t('torrents.auto.query')}</span>
								<Input
									value={query}
									onChange={event => setQuery(event.target.value)}
									startIcon={<Icon name='common/search' size={16} />}
									disabled={saving}
									spellCheck={false}
									placeholder={t('torrents.auto.queryPlaceholder')}
								/>
								<span className={styles.fieldHint}>{t('torrents.auto.queryHint')}</span>
							</label>
						</div>

						<div className={styles.footer}>
							<Button loading={saving} disabled={!dirty} onClick={save}>
								{t('torrents.auto.save')}
							</Button>
							<span className={styles.saveState}>
								{dirty ? t('torrents.auto.unsaved') : t('torrents.auto.saved')}
							</span>
						</div>
					</div>
				</CollapsibleSection>
			</div>
		</div>
	)
}

// Where the rule stands since its last look, until a check run here says more.
function RuleStatus({ rule, setupMissing }: { rule: TorrentRule; setupMissing: boolean }) {
	const { t } = useTranslation()

	if (!rule.enabled) {
		return (
			<Status tone='neutral' icon='common/pause' title={t('torrents.auto.status.paused')}>
				<p>{t('torrents.auto.status.pausedHint')}</p>
			</Status>
		)
	}

	if (rule.last_error && !setupMissing) {
		return (
			<Status tone='danger' icon='common/info' title={t('torrents.auto.status.failed')}>
				<p>{rule.last_error}</p>
			</Status>
		)
	}

	if (!rule.last_checked) {
		return (
			<Status tone='info' icon='common/clock' title={t('torrents.auto.status.pending')}>
				<p>{t('torrents.auto.status.pendingHint')}</p>
			</Status>
		)
	}

	if (rule.last_added > 0) {
		return (
			<Status
				tone='success'
				icon='common/check'
				title={t('torrents.auto.status.added', { count: rule.last_added })}
			>
				<p>{t('torrents.auto.status.addedHint')}</p>
			</Status>
		)
	}

	return (
		<Status tone='success' icon='common/check' title={t('torrents.auto.status.caughtUp')}>
			<p>{t('torrents.auto.status.caughtUpHint')}</p>
		</Status>
	)
}
