/**
 * Signing in, registering, confirming an address and recovering a password:
 * the forms, their local rules, and the frame they share.
 *
 * The session itself — who is signed in, and the requests that establish or
 * revoke that — is `entities/session`. This slice is the scenario around it.
 *
 * Nothing here decides where a step leads: the panels take callbacks and the
 * pages supply them, so the feature never learns what routes exist.
 */
import { newPasswordForm } from './model/new-password'
import { resetPasswordForm } from './model/reset-password'

/** The length of both mailed codes, for screens that describe them. */
export { CODE_LENGTH } from './lib/validation'

export { AuthLayout } from './ui/AuthLayout'
export type { AuthLayoutProps } from './ui/AuthLayout'

export { AuthFormWrapper } from './ui/AuthFormWrapper'
export type { AuthFormWrapperProps } from './ui/AuthFormWrapper'

export { AuthProvidersPanel } from './ui/AuthProvidersPanel'
export type { AuthProvidersPanelProps } from './ui/AuthProvidersPanel'

export { AuthEmailPanel } from './ui/AuthEmailPanel'
export type { AuthEmailPanelProps } from './ui/AuthEmailPanel'

export { AuthVerifyEmailPanel } from './ui/AuthVerifyEmailPanel'
export type { AuthVerifyEmailPanelProps } from './ui/AuthVerifyEmailPanel'

export { AuthResetPasswordPanel } from './ui/AuthResetPasswordPanel'
export type { AuthResetPasswordPanelProps } from './ui/AuthResetPasswordPanel'

export { AuthNewPasswordPanel } from './ui/AuthNewPasswordPanel'
export type { AuthNewPasswordPanelProps } from './ui/AuthNewPasswordPanel'

/**
 * The two moments a recovery screen ends on. Exported as events rather than as
 * the models that own them: a page needs to know that the step finished and
 * with which address, not how the form got there.
 */
export const passwordResetSent = resetPasswordForm.sent
export const passwordResetCompleted = newPasswordForm.succeeded
