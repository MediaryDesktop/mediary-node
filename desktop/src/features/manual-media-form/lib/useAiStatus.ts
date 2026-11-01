import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'

import { $nodeReady } from '@infra/node'

import { aiSettingsQuery } from '@entities/media'

// Whether the AI fill can run, and the one line worth showing about it.
export function useAiStatus() {
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

	return { loaded: Boolean(settings), ready, detail }
}
