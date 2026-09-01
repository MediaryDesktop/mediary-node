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

export const fetchAccountFx = createCloudRequestFx<void, Account>({ url: '/v1/account' })

export const fetchOAuthProvidersFx = createCloudRequestFx<void, OAuthProviders>({
	url: '/v1/account/oauth/providers'
})
