/**
 * Signing in and registering: the two forms, their local rules, and the frame
 * they share.
 *
 * The session itself — who is signed in, and the requests that establish or
 * revoke that — is `entities/session`. This slice is the scenario around it.
 *
 * Nothing here decides where a fresh session lands: the pages listen to
 * `sessionModel.authenticated` for that, so the feature never learns what
 * routes exist.
 */

export { AuthLayout } from './ui/AuthLayout'

export { SignInForm } from './ui/SignInForm'
export type { SignInFormProps } from './ui/SignInForm'

export { SignUpForm } from './ui/SignUpForm'
export type { SignUpFormProps } from './ui/SignUpForm'
