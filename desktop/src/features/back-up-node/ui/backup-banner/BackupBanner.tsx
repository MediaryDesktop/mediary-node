import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { readStored, writeStored } from '@shared/lib'
import { Button, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { sessionModel } from '@entities/session'

import { $updateRequired, $updateUrl, clientGateMounted, syncStatusQuery } from '../../model/model'

import styles from './BackupBanner.module.scss'

const DISMISSED_KEY = 'backup-offer-dismissed'

// One line above the page, for the two states that are about backups and
// nothing else: the build is too old for the cloud, or backups are simply not
// on. Neither blocks anything — the app works fully without an account.
export function BackupBanner() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [dismissed, setDismissed] = useState(() => readStored(DISMISSED_KEY) === '1')

	const [updateRequired, updateUrl, mounted, account, nodeReady, status, loadStatus] = useUnit([
		$updateRequired,
		$updateUrl,
		clientGateMounted,
		sessionModel.$account,
		$nodeReady,
		syncStatusQuery.$data,
		syncStatusQuery.start
	])

	useEffect(() => mounted(), [mounted])

	const verified = account?.email_verified === true

	useEffect(() => {
		if (nodeReady && verified) {
			loadStatus()
		}
	}, [loadStatus, nodeReady, verified])

	if (updateRequired) {
		return (
			<div className={clsx(styles.banner, styles.warning)} role='status'>
				<Icon name='common/info' size={18} />
				<p className={styles.text}>{t('backup.banner.outdated')}</p>
				{updateUrl && (
					<Button size='small' onClick={() => window.open(updateUrl, '_blank', 'noreferrer')}>
						{t('backup.banner.update')}
					</Button>
				)}
			</div>
		)
	}

	// A signed-in account whose node status has not loaded yet says nothing
	// rather than flashing an offer that may be about to disappear.
	const off = !account || (verified && status !== null && !status.linked)

	if (dismissed || !off) {
		return null
	}

	return (
		<div className={styles.banner} role='status'>
			<Icon name='common/cloud' size={18} />
			<p className={styles.text}>{t('backup.banner.offer')}</p>
			<Button size='small' onClick={() => navigate({ to: '/settings', search: { section: 'backup' } })}>
				{t('backup.turnOn')}
			</Button>
			<Button
				variant='ghost'
				size='small'
				onClick={() => {
					writeStored(DISMISSED_KEY, '1')
					setDismissed(true)
				}}
			>
				{t('backup.banner.notNow')}
			</Button>
		</div>
	)
}
