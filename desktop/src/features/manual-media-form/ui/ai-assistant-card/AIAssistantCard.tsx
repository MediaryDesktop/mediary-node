import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aiSettingsQuery } from '@entities/media'

import styles from './AIAssistantCard.module.scss'

export interface AIAssistantCardProps {
	mode: 'create' | 'edit'
	onGenerate: () => void
	pending: boolean
	// The AI is asked about a kind of title; without one it would answer for the
	// wrong one, so the button waits.
	typeMissing?: boolean
	disabled?: boolean
}

export function AIAssistantCard({
	mode,
	onGenerate,
	pending,
	typeMissing = false,
	disabled
}: AIAssistantCardProps) {
	const { t } = useTranslation()

	const [settings, load, nodeReady] = useUnit([aiSettingsQuery.$data, aiSettingsQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const ready = settings?.ready ?? false

	// The free AI shows what is left of today's allowance; an own key, the model.
	const detail = !settings
		? null
		: settings.provider === 'cloud'
			? settings.cloud.known && settings.cloud.enabled
				? t('manualMedia.assistant.remaining', {
						remaining: settings.cloud.remaining,
						limit: settings.cloud.limit
					})
				: null
			: settings.provider === 'openai'
				? settings.openai.model || null
				: settings[settings.provider].model

	return (
		<section className={styles.card}>
			<div className={styles.head}>
				<h3 className={styles.title}>
					<Icon name='common/sparkles' size={16} className={styles.titleIcon} />
					{t('manualMedia.assistant.title')}
				</h3>

				<Link
					to='/settings'
					search={{ section: 'manual-media' }}
					className={styles.settingsLink}
					aria-label={t('manualMedia.assistant.settings')}
					title={t('manualMedia.assistant.settings')}
				>
					{detail && <span className={styles.model}>{detail}</span>}
					<Icon name='common/settings' size={15} />
				</Link>
			</div>

			<p className={styles.description}>{t('manualMedia.assistant.description')}</p>

			<ul className={styles.checklist}>
				<li>
					<Icon name='common/check' size={14} />
					{t('manualMedia.assistant.checklistBasics')}
				</li>
				<li>
					<Icon name='common/check' size={14} />
					{t('manualMedia.assistant.checklistGenres')}
				</li>
				<li>
					<Icon name='common/check' size={14} />
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
					disabled={disabled || !settings || typeMissing}
					onClick={onGenerate}
				>
					{t(mode === 'create' ? 'manualMedia.ai.action' : 'manualMedia.ai.regenerate')}
				</Button>
			)}

			{typeMissing && <p className={styles.typeHint}>{t('manualMedia.assistant.needsType')}</p>}
		</section>
	)
}
