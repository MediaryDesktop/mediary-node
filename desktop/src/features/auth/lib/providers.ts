import type { IconName } from '@shared/ui'

export interface ProviderLook {
	label: string
	icon: IconName
}

const LOOKS: Record<string, ProviderLook> = {
	google: { label: 'Google', icon: 'social/google' },
	facebook: { label: 'Facebook', icon: 'social/facebook' },
	apple: { label: 'Apple', icon: 'social/apple' }
}

export function providerLook(provider: string): ProviderLook | null {
	return LOOKS[provider] ?? null
}

export function providerLabel(provider: string): string {
	return LOOKS[provider]?.label ?? provider
}
