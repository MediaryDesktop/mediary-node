import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, SelectDropdown } from '@shared/ui'

import { setAISettingsMutation } from '@entities/media'
import type { SetAISettingsParams, AISettings as Settings } from '@entities/media'

import { savedKey } from '../../../lib/saved-key'
import styles from '../AIPanel.module.scss'

const KEY_PAGES = {
	claude: 'https://console.anthropic.com/settings/keys',
	gemini: 'https://aistudio.google.com/apikey'
} as const

export interface KeyPanelProps {
	provider: 'claude' | 'gemini'
	settings: Settings['claude']
	saving: boolean
	save: (params: SetAISettingsParams) => void
}

export function KeyPanel({ provider, settings, saving, save }: KeyPanelProps) {
	const { t } = useTranslation()
	const [key, setKey] = useState('')

	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		if (savedKey(params, provider)) {
			setKey('')
		}
	})

	const name = t(`ai.providers.${provider}`)

	if (!settings.available) {
		return <p className={styles.note}>{t('ai.disabled', { provider: name })}</p>
	}

	const trimmed = key.trim()

	return (
		<div className={styles.panel}>
			<form
				className={styles.form}
				onSubmit={event => {
					event.preventDefault()
					if (trimmed) {
						save({ [provider]: { api_key: trimmed } })
					}
				}}
			>
				<SelectDropdown
					className={styles.modelField}
					value={settings.model}
					onChange={model => model && save({ [provider]: { model } })}
					options={(settings.models ?? []).map(model => ({ value: model, label: model }))}
					disabled={saving}
				/>

				<Input
					className={styles.keyInput}
					type='password'
					value={key}
					onChange={event => setKey(event.target.value)}
					placeholder={t('ai.key.placeholder', { provider: name })}
					autoComplete='off'
					disabled={saving}
				/>
				<Button type='submit' disabled={!trimmed || saving} loading={saving}>
					{t('ai.key.save')}
				</Button>
			</form>

			<div className={styles.actions}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/external-link' size={16} />}
					onClick={() => window.open(KEY_PAGES[provider], '_blank', 'noreferrer')}
				>
					{t('ai.key.getKey')}
				</Button>

				{settings.configured && (
					<Button
						variant='ghost'
						size='small'
						disabled={saving}
						onClick={() => save({ [provider]: { api_key: '' } })}
					>
						{t('ai.key.remove')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('ai.note')}</p>
		</div>
	)
}
