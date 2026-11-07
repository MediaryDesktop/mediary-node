import { useUnit } from 'effector-react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Switch, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { deleteTorrentRuleMutation, putTorrentRuleMutation, torrentRuleQuery } from '@entities/torrent'

import styles from './AutoDownloadPanel.module.scss'
import { RuleDetails } from './rule-details/RuleDetails'

export interface AutoDownloadPanelProps {
	mediaRef: string
	title: string
}

export function AutoDownloadPanel({ mediaRef, title }: AutoDownloadPanelProps) {
	const { t } = useTranslation()

	const [data, put, saving] = useUnit([
		torrentRuleQuery.$data,
		putTorrentRuleMutation.start,
		putTorrentRuleMutation.$pending
	])

	useNodeData(torrentRuleQuery, { params: mediaRef })

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('torrents.auto.saveFailed')), { id: 'torrent-rule' })

	useUnitWatch(putTorrentRuleMutation.finished.failure, failed)
	useUnitWatch(deleteTorrentRuleMutation.finished.failure, failed)

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
					<IoIosRefresh size={22} />
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
