import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'

import { $nodeReady } from '@infra/node'

import { aiSettingsQuery } from '@entities/media'

export function useAiStatus() {
	const { t } = useTranslation()

	const [settings, load, nodeReady] = useUnit([aiSettingsQuery.$data, aiSettingsQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const ready = settings?.ready ?? false

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

	return { loaded: Boolean(settings), ready, detail }
}
