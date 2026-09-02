import { createCloudRequestFx } from '@infra/cloud'
import type { CloudSchemas } from '@infra/cloud'

/**
 * The cloud's account endpoints, typed from the generated contract.
 *
 * Every shape here is `CloudSchemas[...]` rather than a hand-written interface:
 * a field renamed in the cloud must break this file at compile time, which is
 * the entire reason the contract is generated rather than described twice.
 */

export type Session = CloudSchemas['SessionBody']
export type Account = CloudSchemas['Body']
export type RegisterInput = CloudSchemas['RegisterInputBody']
export type LoginInput = CloudSchemas['LoginInputBody']
export type OAuthProviders = CloudSchemas['OAuthProvidersOutputBody']
export type OAuthStart = CloudSchemas['OAuthStartOutputBody']
export type ConfirmEmailInput = CloudSchemas['ConfirmEmailInputBody']
export type PasswordResetRequest = CloudSchemas['RequestPasswordResetInputBody']
export type PasswordResetInput = CloudSchemas['CompletePasswordResetInputBody']
export type Accepted = CloudSchemas['AcceptedOutputBody']

/** An OAuth callback names its provider in the path and its pair in the body. */
export type OAuthCallbackInput = CloudSchemas['OAuthCallbackInputBody'] & { provider: string }

/**
 * `expectsUnauthorized` on the two credential checks: here 401 means "wrong
 * password", not "your session died". Without it a mistyped password would
 * sign out a user who was already signed in on another form.
 */

export const signInFx = createCloudRequestFx<LoginInput, Session>(body => ({
	url: '/v1/account/sessions',
	method: 'POST',
	body,
	expectsUnauthorized: true
}))

export const signUpFx = createCloudRequestFx<RegisterInput, Session>(body => ({
	url: '/v1/account/register',
	method: 'POST',
	body,
	expectsUnauthorized: true
}))

export const signOutFx = createCloudRequestFx<void, void>({
	url: '/v1/account/sessions/current',
	method: 'DELETE',
	expectsUnauthorized: true
})

export const fetchAccountFx = createCloudRequestFx<void, Account>({ url: '/v1/account/me' })

// --- Email confirmation ---

/**
 * Takes no address on purpose: the session already says who is asking, so the
 * endpoint cannot be used to find out which addresses are registered.
 */
export const sendEmailVerificationFx = createCloudRequestFx<void, Accepted>({
	url: '/v1/account/email/verification',
	method: 'POST'
})

export const confirmEmailFx = createCloudRequestFx<ConfirmEmailInput, Account>(body => ({
	url: '/v1/account/email/verification/confirm',
	method: 'POST',
	body
}))

// --- Password recovery ---

/**
 * The answer is the same whether or not the address has an account — see the
 * endpoint's own description. Nothing in the UI may imply otherwise.
 */
export const requestPasswordResetFx = createCloudRequestFx<PasswordResetRequest, Accepted>(body => ({
	url: '/v1/account/password/reset',
	method: 'POST',
	body
}))

/**
 * `expectsUnauthorized` for the same reason the sign-in call has it: 401 here
 * is a wrong or expired code, and treating it as an expired session would sign
 * out whoever was reading the mail in another window.
 */
export const completePasswordResetFx = createCloudRequestFx<PasswordResetInput, void>(body => ({
	url: '/v1/account/password/reset/confirm',
	method: 'POST',
	body,
	expectsUnauthorized: true
}))

// --- OAuth ---

export const fetchOAuthProvidersFx = createCloudRequestFx<void, OAuthProviders>({
	url: '/v1/account/oauth/providers'
})

export const startOAuthFx = createCloudRequestFx<string, OAuthStart>(provider => ({
	url: `/v1/account/oauth/${encodeURIComponent(provider)}/start`,
	method: 'POST'
}))

/** 401 means the state was rejected, not that the caller's session expired. */
export const completeOAuthFx = createCloudRequestFx<OAuthCallbackInput, Session>(({ provider, ...body }) => ({
	url: `/v1/account/oauth/${encodeURIComponent(provider)}/callback`,
	method: 'POST',
	body,
	expectsUnauthorized: true
}))
