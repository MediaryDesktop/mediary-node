import { useUnit } from 'effector-react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Badge, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { aiSettingsQuery, setAISettingsMutation } from '@entities/media'
import type { AIProvider } from '@entities/media'

import styles from './AISettings.module.scss'
import { CloudPanel } from './cloud-panel/CloudPanel'
import { KeyPanel } from './key-panel/KeyPanel'
import { OpenAIPanel } from './openai-panel/OpenAIPanel'
import { ProviderOption } from './provider-option/ProviderOption'

const PROVIDERS: readonly AIProvider[] = ['cloud', 'claude', 'gemini', 'openai']

export function AISettings() {
	const { t } = useTranslation()

	const [settings, save, saving] = useUnit([
		aiSettingsQuery.$data,
		setAISettingsMutation.start,
		setAISettingsMutation.$pending
	])

	useNodeData(aiSettingsQuery)

	useUnitWatch(setAISettingsMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('ai.saveFailed')), { id: 'ai-settings' })
	)
	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		const key = params.claude?.api_key ?? params.gemini?.api_key ?? params.openai?.api_key

		if (params.openai?.endpoint !== undefined || key) {
			toast.success(t('ai.saved'), { id: 'ai-settings' })
		} else if (key === '') {
			toast.success(t('ai.cleared'), { id: 'ai-settings' })
		}
	})

	if (!settings) {
		return null
	}

	return (
		<div className={styles.root}>
			<div role='radiogroup' aria-label={t('ai.providerLabel')} className={styles.providerGrid}>
				{PROVIDERS.map(provider => (
					<ProviderOption
						key={provider}
						label={t(`ai.providers.${provider}`)}
						selected={settings.provider === provider}
						disabled={saving}
						onSelect={() => save({ provider })}
						badge={provider === 'cloud' ? <Badge size='sm'>{t('ai.free')}</Badge> : undefined}
					/>
				))}
			</div>

			{settings.provider === 'cloud' && <CloudPanel settings={settings} />}

			{(settings.provider === 'claude' || settings.provider === 'gemini') && (
				<KeyPanel
					key={settings.provider}
					provider={settings.provider}
					settings={settings[settings.provider]}
					saving={saving}
					save={save}
				/>
			)}

			{settings.provider === 'openai' && (
				<OpenAIPanel settings={settings.openai} saving={saving} save={save} />
			)}
		</div>
	)
}
