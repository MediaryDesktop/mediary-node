import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Notice, noticeActionVariant } from '@shared/ui'

import { useAppUpdate } from '@infra/update'

import styles from './UpdateBanner.module.scss'

export function UpdateBanner() {
	const { t } = useTranslation()
	const { state, installing, onInstall } = useAppUpdate()
	const [laterFor, setLaterFor] = useState<string | null>(null)

	if (state.kind !== 'ready' && state.kind !== 'manual') {
		return null
	}

	if (laterFor === state.version) {
		return null
	}

	const later = (
		<Button size='small' variant='ghost' onClick={() => setLaterFor(state.version)}>
			{t('update.later')}
		</Button>
	)

	if (state.kind === 'manual') {
		return (
			<Notice
				className={styles.banner}
				title={t('update.manual.title', { version: state.version })}
				action={
					<>
						{later}
						<Button
							size='small'
							variant={noticeActionVariant('info')}
							onClick={() => window.open(state.url, '_blank', 'noreferrer')}
						>
							{t('update.download')}
						</Button>
					</>
				}
			>
				{t('update.manual.text')}
			</Notice>
		)
	}

	return (
		<Notice
			className={styles.banner}
			title={t('update.ready.title', { version: state.version })}
			action={
				<>
					{later}
					<Button
						size='small'
						variant={noticeActionVariant('info')}
						loading={installing}
						onClick={onInstall}
					>
						{t('update.restart')}
					</Button>
				</>
			}
		>
			{t('update.ready.text')}
		</Notice>
	)
}
