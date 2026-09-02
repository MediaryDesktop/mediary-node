import type { IconName } from '@shared/ui'

/**
 * How a provider is drawn, for the providers the deployment happens to offer.
 *
 * The list itself comes from the cloud (`oauthProvidersQuery`) — a build that
 * hardcoded it would offer buttons that answer 404. This is only the label and
 * the mark, which the contract has no field for; a provider the cloud adds
 * before this table knows about it still works, it just shows its bare name.
 */

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
