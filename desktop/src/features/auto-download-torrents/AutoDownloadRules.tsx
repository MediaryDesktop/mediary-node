import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatRelativeTime } from '@shared/lib'

import { $nodeReady } from '@infra/node'

import { torrentRulesQuery } from '@entities/torrent'

import styles from './AutoDownloadRules.module.scss'

// Every title the node downloads new episodes of by itself. Each is changed on
// its own page, so the list only says how each one is doing.
export function AutoDownloadRules() {
	const { t, i18n } = useTranslation()

	const [data, load, nodeReady] = useUnit([torrentRulesQuery.$data, torrentRulesQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const rules = data?.rules ?? []

	if (rules.length === 0) {
		return null
	}

	return (
		<section className={styles.root}>
			<h2 className={styles.title}>{t('torrents.auto.listTitle')}</h2>

			<ul className={styles.list}>
				{rules.map(rule => (
					<li key={rule.media_ref} className={clsx(styles.row, !rule.enabled && styles.off)}>
						<Link
							to='/media/$mediaRef'
							params={{ mediaRef: rule.media_ref }}
							className={styles.name}
						>
							{rule.title}
						</Link>
						<span className={styles.meta}>
							{rule.enabled ? t('torrents.auto.on') : t('torrents.auto.off')}
							{' · '}
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
						</span>
						{rule.last_error && <span className={styles.problem}>{rule.last_error}</span>}
					</li>
				))}
			</ul>
		</section>
	)
}
