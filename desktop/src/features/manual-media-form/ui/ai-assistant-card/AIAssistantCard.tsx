import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Badge, Button, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aiSettingsQuery } from '@entities/media'

import styles from './AIAssistantCard.module.scss'

export interface AIAssistantCardProps {
	mode: 'create' | 'edit'
	onGenerate: () => void
	pending: boolean
	disabled?: boolean
}

export function AIAssistantCard({ mode, onGenerate, pending, disabled }: AIAssistantCardProps) {
	const { t } = useTranslation()

	const [settings, load, nodeReady] = useUnit([aiSettingsQuery.$data, aiSettingsQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const ready = settings?.enabled && settings.key_source === 'user'

	return (
		<div className={styles.card}>
			<div className={styles.head}>
				<span className={styles.badgeIcon}>
					<Icon name='common/wand-sparkles' size={18} />
				</span>

				<h3 className={styles.title}>{t('manualMedia.assistant.title')}</h3>

				{settings?.model && (
					<Badge tone='neutral' size='sm'>
						{settings.model}
					</Badge>
				)}
			</div>

			<p className={styles.description}>{t('manualMedia.assistant.description')}</p>

			<ul className={styles.checklist}>
				<li>
					<Icon name='common/check-circle-2' size={15} />
					{t('manualMedia.assistant.checklistBasics')}
				</li>
				<li>
					<Icon name='common/check-circle-2' size={15} />
					{t('manualMedia.assistant.checklistGenres')}
				</li>
				<li>
					<Icon name='common/check-circle-2' size={15} />
					{t('manualMedia.assistant.checklistCover')}
				</li>
			</ul>

			{settings && !ready ? (
				<Link to='/settings' search={{ section: 'manual-media' }} className={styles.setupLink}>
					<Icon name='common/settings' size={15} />
					{t('manualMedia.assistant.needsKey')}
				</Link>
			) : (
				<Button
					variant='primary'
					fullWidth
					startIcon={<Icon name='common/wand-sparkles' size={18} />}
					loading={pending}
					disabled={disabled || !settings}
					onClick={onGenerate}
				>
					{t(mode === 'create' ? 'manualMedia.ai.action' : 'manualMedia.ai.regenerate')}
				</Button>
			)}

			<Link to='/settings' search={{ section: 'manual-media' }} className={styles.settingsRow}>
				<Icon name='common/settings' size={14} />
				{t('manualMedia.assistant.settings')}
			</Link>
		</div>
	)
}
