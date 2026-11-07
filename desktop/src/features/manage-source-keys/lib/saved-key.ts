import type { SetAISettingsParams } from '@entities/media'

type KeyedProvider = 'claude' | 'gemini' | 'openai'

// Whether a save carried this provider's key. Only then is the key a panel
// holds in its field spent: a save of the model, the endpoint or another
// provider leaves a key typed but not saved yet where it is.
export function savedKey(params: SetAISettingsParams, provider: KeyedProvider): boolean {
	return params[provider]?.api_key !== undefined
}
