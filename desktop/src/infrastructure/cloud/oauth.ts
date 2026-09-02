import { createEffect } from 'effector'

/**
 * The step of OAuth sign-in that happens outside the cloud: the user in front
 * of the provider's consent page.
 *
 * The cloud builds the consent URL and later exchanges what comes back, but
 * neither end of that can run in the renderer — the redirect has to be caught
 * before Chromium fetches it, and only the main process can watch another
 * window's navigation. So this is one call across the preload bridge, wrapped
 * as an effect because everything else in the flow is one too.
 *
 * `window.mediary` is an ambient global declared by the preload bridge types in
 * `infrastructure/node`; it is read here rather than imported because two
 * infrastructure slices may not import each other. `OAuthRedirect` is therefore
 * declared again below — structurally, so `npm run typecheck` still fails if
 * the two ever disagree.
 */

export interface OAuthRedirect {
	code: string
	state: string
}

/** Closing the window is an answer, not a failure — see the main-process side. */
export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

export function wasCancelled(authorization: OAuthAuthorization): authorization is { cancelled: true } {
	return 'cancelled' in authorization
}

/** Rejects only when the provider refuses or the redirect is unusable. */
export const authorizeOAuthFx = createEffect<string, OAuthAuthorization>(consentUrl =>
	window.mediary.oauth.authorize(consentUrl)
)
