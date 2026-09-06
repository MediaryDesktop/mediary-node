export interface OAuthRedirect {
	code: string
	state: string
}

export type OAuthAuthorization = OAuthRedirect | { cancelled: true }

export interface OAuthListener {
	callbackPort: number
}

export const OAUTH_CALLBACK_PATH = '/oauth/callback'

export function wasCancelled(authorization: OAuthAuthorization): authorization is { cancelled: true } {
	return 'cancelled' in authorization
}
