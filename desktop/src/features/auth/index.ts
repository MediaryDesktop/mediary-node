import { newPasswordForm } from './model/new-password'
import { resetPasswordForm } from './model/reset-password'

export { CODE_LENGTH } from './lib/validation'

export { AuthLayout } from './ui/AuthLayout'
export { AuthFormWrapper } from './ui/AuthFormWrapper'
export { AuthProvidersPanel } from './ui/AuthProvidersPanel'
export { AuthEmailPanel } from './ui/AuthEmailPanel'
export { AuthVerifyEmailPanel } from './ui/AuthVerifyEmailPanel'
export { AuthResetPasswordPanel } from './ui/AuthResetPasswordPanel'
export { AuthNewPasswordPanel } from './ui/AuthNewPasswordPanel'

export const passwordResetSent = resetPasswordForm.sent
export const passwordResetCompleted = newPasswordForm.succeeded
