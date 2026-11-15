import { deleteAccountForm, newPasswordForm, resetPasswordForm } from './model'

export { CODE_LENGTH } from './validation'

export { AuthFormWrapper, AuthLayout, useAuthBack } from './ui/common'
export {
	AuthEmailPanel,
	AuthNewPasswordPanel,
	AuthProvidersPanel,
	AuthResetPasswordPanel,
	AuthVerifyEmailPanel
} from './ui/flow'
export { DeleteAccountDialog } from './ui/delete-account'

export const passwordResetSent = resetPasswordForm.sent
export const passwordResetCompleted = newPasswordForm.succeeded
export const accountDeletionOpened = deleteAccountForm.opened
