import { createCloudRequestFx } from '@infra/cloud'
import type { CloudSchemas } from '@infra/cloud'

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

export type OAuthCallbackInput = CloudSchemas['OAuthCallbackInputBody'] & { provider: string }

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

export const sendEmailVerificationFx = createCloudRequestFx<void, Accepted>({
	url: '/v1/account/email/verification',
	method: 'POST'
})

export const confirmEmailFx = createCloudRequestFx<ConfirmEmailInput, Account>(body => ({
	url: '/v1/account/email/verification/confirm',
	method: 'POST',
	body
}))

export const requestPasswordResetFx = createCloudRequestFx<PasswordResetRequest, Accepted>(body => ({
	url: '/v1/account/password/reset',
	method: 'POST',
	body
}))

export const completePasswordResetFx = createCloudRequestFx<PasswordResetInput, void>(body => ({
	url: '/v1/account/password/reset/confirm',
	method: 'POST',
	body,
	expectsUnauthorized: true
}))

export const fetchOAuthProvidersFx = createCloudRequestFx<void, OAuthProviders>({
	url: '/v1/account/oauth/providers'
})

export interface OAuthStartInput {
	provider: string
	callbackPort: number
}

export const startOAuthFx = createCloudRequestFx<OAuthStartInput, OAuthStart>(
	({ provider, callbackPort }) => ({
		url: `/v1/account/oauth/${encodeURIComponent(provider)}/start`,
		method: 'POST',
		body: { callback_port: callbackPort }
	})
)

export const completeOAuthFx = createCloudRequestFx<OAuthCallbackInput, Session>(({ provider, ...body }) => ({
	url: `/v1/account/oauth/${encodeURIComponent(provider)}/callback`,
	method: 'POST',
	body,
	expectsUnauthorized: true
}))
