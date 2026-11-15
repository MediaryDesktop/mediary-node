import { createEvent, createStore, sample } from 'effector'

import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { sessionModel } from '@entities/session'

import { notifyFailure } from '../lib'
import { validateCode } from '../validation'

import { createAuthForm } from './form'

export type DeleteAccountStep = 'warning' | 'code'

// Deleting the account takes a mailed code, not only the open session: one
// left open, or stolen, must not be able to erase everything the owner stored.
export const deleteAccountForm = atom(() => {
	const opened = createEvent()
	const closed = createEvent()
	const codeRequested = createEvent()

	const $open = createStore(false)
		.on(opened, () => true)
		.reset(closed, sessionModel.accountDeleted)

	const $step = createStore<DeleteAccountStep>('warning')
		.on(sessionModel.accountDeletionCodeSent, () => 'code')
		.reset(opened)

	const $expiresAt = createStore<string | null>(null)
		.on(sessionModel.accountDeletionCodeSent, (_, accepted) => accepted.expires_at)
		.reset(opened)

	const form = createAuthForm({
		fields: ['code'] as const,
		validate: values => [validateCode(values.code)],
		prepare: values => ({ code: values.code.trim() }),
		submit: sessionModel.accountDeletionConfirmed,
		pending: sessionModel.$accountDeletionPending,
		failure: sessionModel.accountDeletionFailed
	})

	sample({ clock: codeRequested, target: sessionModel.accountDeletionRequested })
	sample({ clock: [opened, codeRequested], fn: () => '', target: form.fields.code.changed })

	sessionModel.accountDeletionCodeFailed.watch(notifyFailure)
	sessionModel.accountDeleted.watch(() => toast.success(translate('auth.deleteAccount.deleted')))

	return {
		...form,
		opened,
		closed,
		codeRequested,
		$open,
		$step,
		$expiresAt,
		$codePending: sessionModel.$accountDeletionCodePending
	}
})
