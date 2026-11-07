import { Link, useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatRelativeTime, useUnitWatch } from '@shared/lib'
import { Button, EmptyState, Icon, MoreMenu, PosterFade, Switch, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { mediaPreviewModel } from '@entities/media'
import {
	checkTorrentRuleMutation,
	deleteTorrentRuleMutation,
	putTorrentRuleMutation,
	torrentRulesQuery,
	TorrentSetupNotice,
	useTorrentSetup
} from '@entities/torrent'
import type { TorrentRule } from '@entities/torrent'

import styles from './AutoDownloadRules.module.scss'

export function AutoDownloadRules() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const setup = useTorrentSetup()

	const [data, previews, requestPreview] = useUnit([
		torrentRulesQuery.$data,
		mediaPreviewModel.$previews,
		mediaPreviewModel.previewRequested
	])

	useNodeData(torrentRulesQuery)

	useUnitWatch(checkTorrentRuleMutation.finished.success, ({ result }) =>
		toast.success(
			result.added > 0
				? t('torrents.auto.addedToast', { count: result.added })
				: t('torrents.auto.nothing'),
			{ id: 'torrent-rule-check' }
		)
	)
	useUnitWatch(checkTorrentRuleMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.auto.checkFailed')), {
			id: 'torrent-rule-check'
		})
	)

	const rules = data?.rules ?? []

	useEffect(() => {
		for (const ref of new Set(rules.map(rule => rule.media_ref))) {
			requestPreview(ref)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `rules` is stable enough: it only grows a new identity when `data` itself does.
	}, [data, requestPreview])

	const setupMissing =
		setup.loaded && (!setup.clientConfigured || setup.clientReachable === false || !setup.hasSources)

	return (
		<section className={styles.root}>
			{rules.length > 0 && (
				<TorrentSetupNotice
					setup={setup}
					needSearch
					onOpenSettings={() =>
						navigate({
							to: '/settings',
							search: { section: 'torrents' }
						})
					}
				/>
			)}

			{rules.length === 0 ? (
				<EmptyState
					title={t('torrents.auto.emptyTitle')}
					description={t('torrents.auto.emptyHint')}
				/>
			) : (
				<ul className={styles.list}>
					{rules.map(rule => (
						<RuleRow
							key={rule.media_ref}
							rule={rule}
							setupMissing={setupMissing}
							poster={previews[rule.media_ref]?.cover_image}
						/>
					))}
				</ul>
			)}
		</section>
	)
}

function RuleRow({
	rule,
	setupMissing,
	poster
}: {
	rule: TorrentRule
	setupMissing: boolean
	poster?: string | null
}) {
	const { t, i18n } = useTranslation()

	const [put, check, remove, checking] = useUnit([
		putTorrentRuleMutation.start,
		checkTorrentRuleMutation.start,
		deleteTorrentRuleMutation.start,
		checkTorrentRuleMutation.$pending
	])

	const [mine, setMine] = useState(false)
	useUnitWatch(checkTorrentRuleMutation.finished.finally, () => setMine(false))

	return (
		<li className={clsx(styles.row, !rule.enabled && styles.off)}>
			{poster && <PosterFade src={poster} className={styles.poster} />}

			<div className={styles.body}>
				<Link to='/media/$mediaRef' params={{ mediaRef: rule.media_ref }} className={styles.name}>
					{rule.title}
				</Link>
				<span className={styles.meta}>
					{t('torrents.auto.fromShort', { episode: rule.from_episode })}
					{rule.query && <> · {t('torrents.auto.queryShort', { query: rule.query })}</>}
					{rule.last_checked && (
						<>
							{' · '}
							{t('torrents.auto.lastChecked', {
								when: formatRelativeTime(rule.last_checked, i18n.language),
								count: rule.last_added
							})}
						</>
					)}
				</span>
				{rule.last_error && !setupMissing && (
					<span className={styles.problem}>{rule.last_error}</span>
				)}
			</div>

			<div className={styles.actions}>
				<Button
					size='small'
					variant='ghost'
					startIcon={<Icon name='common/download' size={14} />}
					loading={checking && mine}
					disabled={checking || setupMissing}
					onClick={() => {
						setMine(true)
						check({ mediaRef: rule.media_ref, preview: false })
					}}
				>
					{t('torrents.auto.checkNow')}
				</Button>

				<Switch
					checked={rule.enabled}
					onChange={enabled =>
						put({
							mediaRef: rule.media_ref,
							body: {
								title: rule.title,
								query: rule.query,
								from_episode: rule.from_episode,
								enabled
							}
						})
					}
					label={rule.enabled ? t('torrents.auto.on') : t('torrents.auto.off')}
				/>

				<MoreMenu
					label={t('torrents.menu')}
					items={[
						{
							id: 'remove',
							label: t('torrents.auto.remove'),
							icon: 'common/trash',
							danger: true,
							onSelect: () => remove(rule.media_ref)
						}
					]}
				/>
			</div>
		</li>
	)
}
