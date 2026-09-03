import { createEffect } from 'effector'

export interface OAuthRedirect {
	code: string
	state: string
}

export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

export function wasCancelled(authorization: OAuthAuthorization): authorization is { cancelled: true } {
	return 'cancelled' in authorization
}

export const authorizeOAuthFx = createEffect<string, OAuthAuthorization>(consentUrl =>
	window.mediary.oauth.authorize(consentUrl)
)
