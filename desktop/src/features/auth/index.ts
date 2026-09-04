import { newPasswordForm, resetPasswordForm } from './model'

export { CODE_LENGTH } from './validation'

export { AuthFormWrapper, AuthLayout } from './ui/common'
export {
	AuthEmailPanel,
	AuthNewPasswordPanel,
	AuthProvidersPanel,
	AuthResetPasswordPanel,
	AuthVerifyEmailPanel
} from './ui/flow'

export const passwordResetSent = resetPasswordForm.sent
export const passwordResetCompleted = newPasswordForm.succeeded
