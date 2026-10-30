import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aiSettingsQuery } from '@entities/media'

import type { FillModeValue } from '../fill-mode/FillMode'
import { FillMode } from '../fill-mode/FillMode'

import styles from './AIAssistantCard.module.scss'

export interface AIAssistantCardProps {
	mode: 'create' | 'edit'
	fillMode: FillModeValue
	onFillModeChange: (value: FillModeValue) => void
	onGenerate: () => void
	pending: boolean
	disabled?: boolean
}

export function AIAssistantCard({
	mode,
	fillMode,
	onFillModeChange,
	onGenerate,
	pending,
	disabled
}: AIAssistantCardProps) {
	const { t } = useTranslation()

	const [settings, load, nodeReady] = useUnit([aiSettingsQuery.$data, aiSettingsQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const ready = settings?.enabled && settings.key_source === 'user'

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
					{settings?.model && <span className={styles.model}>{settings.model}</span>}
					<Icon name='common/settings' size={15} />
				</Link>
			</div>

			<FillMode value={fillMode} onChange={onFillModeChange} disabled={disabled} />

			{fillMode === 'manual' ? (
				<p className={styles.description}>{t('manualMedia.mode.manualHint')}</p>
			) : (
				<>
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
						<Link
							to='/settings'
							search={{ section: 'manual-media' }}
							className={styles.setupLink}
						>
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
				</>
			)}
		</section>
	)
}
