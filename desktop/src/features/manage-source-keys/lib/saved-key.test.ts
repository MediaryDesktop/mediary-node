import { describe, expect, it } from 'vitest'

import { savedKey } from './saved-key'

describe('savedKey', () => {
	it('is true for a save of this provider’s key, cleared or not', () => {
		expect(savedKey({ claude: { api_key: 'sk-1' } }, 'claude')).toBe(true)
		expect(savedKey({ claude: { api_key: '' } }, 'claude')).toBe(true)
	})

	it('is false for a save of the model, or of another provider', () => {
		expect(savedKey({ claude: { model: 'opus' } }, 'claude')).toBe(false)
		expect(savedKey({ gemini: { api_key: 'g' } }, 'claude')).toBe(false)
		expect(savedKey({ provider: 'cloud' }, 'openai')).toBe(false)
	})
})
