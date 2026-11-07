import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Input } from '@shared/ui'

import { setAISettingsMutation } from '@entities/media'
import type { SetAISettingsParams, AISettings as Settings } from '@entities/media'

import { savedKey } from '../../../lib/saved-key'
import styles from '../AIPanel.module.scss'

const ENDPOINT_PRESETS = [
	{ label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
	{ label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
	{ label: 'Ollama', endpoint: 'http://localhost:11434/v1' },
	{ label: 'LM Studio', endpoint: 'http://localhost:1234/v1' }
] as const

export interface OpenAIPanelProps {
	settings: Settings['openai']
	saving: boolean
	save: (params: SetAISettingsParams) => void
}

export function OpenAIPanel({ settings, saving, save }: OpenAIPanelProps) {
	const { t } = useTranslation()

	const [endpoint, setEndpoint] = useState(settings.endpoint)
	const [model, setModel] = useState(settings.model)
	const [key, setKey] = useState('')

	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		if (savedKey(params, 'openai')) {
			setKey('')
		}
	})

	const dirty =
		endpoint.trim() !== settings.endpoint || model.trim() !== settings.model || key.trim() !== ''

	return (
		<form
			className={styles.panel}
			onSubmit={event => {
				event.preventDefault()
				save({
					openai: {
						endpoint: endpoint.trim(),
						model: model.trim(),
						...(key.trim() ? { api_key: key.trim() } : {})
					}
				})
			}}
		>
			<div className={styles.presets}>
				{ENDPOINT_PRESETS.map(preset => (
					<button
						key={preset.label}
						type='button'
						className={styles.preset}
						aria-pressed={endpoint === preset.endpoint}
						disabled={saving}
						onClick={() => setEndpoint(preset.endpoint)}
					>
						{preset.label}
					</button>
				))}
			</div>

			<div className={styles.row}>
				<label className={styles.field}>
					<span className={styles.label}>{t('ai.openai.endpoint')}</span>
					<Input
						value={endpoint}
						onChange={event => setEndpoint(event.target.value)}
						placeholder='https://api.openai.com/v1'
						autoComplete='off'
						disabled={saving}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>{t('ai.model')}</span>
					<Input
						value={model}
						onChange={event => setModel(event.target.value)}
						placeholder={t('ai.openai.modelPlaceholder')}
						autoComplete='off'
						disabled={saving}
					/>
				</label>
			</div>

			<div className={styles.keyRow}>
				<label className={styles.field}>
					<span className={styles.label}>
						{settings.has_key ? t('ai.openai.keySaved') : t('ai.openai.key')}
					</span>
					<Input
						type='password'
						value={key}
						onChange={event => setKey(event.target.value)}
						placeholder={t('ai.openai.keyPlaceholder')}
						autoComplete='off'
						disabled={saving}
					/>
				</label>

				<Button type='submit' disabled={!dirty || saving} loading={saving}>
					{t('ai.key.save')}
				</Button>

				{settings.has_key && (
					<Button
						type='button'
						variant='ghost'
						size='small'
						disabled={saving}
						onClick={() => save({ openai: { api_key: '' } })}
					>
						{t('ai.key.remove')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('ai.note')}</p>
		</form>
	)
}
