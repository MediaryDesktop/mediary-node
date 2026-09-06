import { createEffect } from 'effector'

import type { OAuthAuthorization, OAuthListener, OAuthRedirect } from '@shared/bridge'

export type { OAuthAuthorization, OAuthListener, OAuthRedirect }

export function wasCancelled(authorization: OAuthAuthorization): authorization is { cancelled: true } {
	return 'cancelled' in authorization
}

export const prepareOAuthFx = createEffect<void, OAuthListener>(() => window.mediary.oauth.prepare())

export const authorizeOAuthFx = createEffect<string, OAuthAuthorization>(consentUrl =>
	window.mediary.oauth.authorize(consentUrl)
)

export const releaseOAuthFx = createEffect<void, void>(() => window.mediary.oauth.release())
