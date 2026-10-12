import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { deleteTorrentRuleMutation, putTorrentRuleMutation, torrentRuleQuery } from '@entities/torrent'

import styles from './AutoDownloadPanel.module.scss'
import { RuleDetails } from './rule-details/RuleDetails'

export interface AutoDownloadPanelProps {
	mediaRef: string
	// The title's name; it also names the folder downloads go into.
	title: string
}

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

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('torrents.auto.saveFailed')), { id: 'torrent-rule' })

	useUnitWatch(putTorrentRuleMutation.finished.failure, failed)
	useUnitWatch(deleteTorrentRuleMutation.finished.failure, failed)

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
