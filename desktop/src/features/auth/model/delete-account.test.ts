import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { deleteAccountFx, requestAccountDeletionFx, sessionModel } from '@entities/session'

import { deleteAccountForm } from './delete-account'

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))

vi.mock('@shared/ui', () => ({ toast: toasts }))
vi.mock('@shared/i18n', () => ({ translate: (key: string) => key }))

const ACCEPTED = { expires_at: '2026-11-15T12:00:00Z', message: 'sent' }

function scopeWith(deleteAnswer = vi.fn().mockResolvedValue(undefined)) {
	const sendCode = vi.fn().mockResolvedValue(ACCEPTED)

	return {
		sendCode,
		deleteAnswer,
		scope: fork({
			handlers: [
				[requestAccountDeletionFx, sendCode],
				[deleteAccountFx, deleteAnswer]
			]
		})
	}
}

describe('deleting the account', () => {
	it('asks for a code first and deletes nothing on opening', async () => {
		const { scope, sendCode, deleteAnswer } = scopeWith()

		await allSettled(deleteAccountForm.opened, { scope })

		expect(scope.getState(deleteAccountForm.$step)).toBe('warning')
		expect(sendCode).not.toHaveBeenCalled()
		expect(deleteAnswer).not.toHaveBeenCalled()
	})

	it('moves to the code once the cloud has mailed it', async () => {
		const { scope, sendCode } = scopeWith()

		await allSettled(deleteAccountForm.opened, { scope })
		await allSettled(deleteAccountForm.codeRequested, { scope })

		expect(sendCode).toHaveBeenCalledTimes(1)
		expect(scope.getState(deleteAccountForm.$step)).toBe('code')
		expect(scope.getState(deleteAccountForm.$expiresAt)).toBe(ACCEPTED.expires_at)
	})

	it('sends no incomplete code to the cloud', async () => {
		const { scope, deleteAnswer } = scopeWith()

		await allSettled(deleteAccountForm.fields.code.changed, { scope, params: '123' })
		await allSettled(deleteAccountForm.submitted, { scope })

		expect(deleteAnswer).not.toHaveBeenCalled()
		expect(toasts.error).toHaveBeenCalled()
	})

	it('signs out and closes once the account is gone', async () => {
		const { scope, deleteAnswer } = scopeWith()
		const signedOut = vi.fn()
		const unwatch = sessionModel.signedOut.watch(signedOut)

		await allSettled(deleteAccountForm.opened, { scope })
		await allSettled(deleteAccountForm.fields.code.changed, { scope, params: ' 123456 ' })
		await allSettled(deleteAccountForm.submitted, { scope })

		unwatch()

		expect(deleteAnswer).toHaveBeenCalledWith({ code: '123456' })
		expect(signedOut).toHaveBeenCalled()
		expect(scope.getState(deleteAccountForm.$open)).toBe(false)
	})

	it('keeps the dialog open on a wrong code', async () => {
		const { scope } = scopeWith(vi.fn().mockRejectedValue(new Error('the code is wrong')))

		await allSettled(deleteAccountForm.opened, { scope })
		await allSettled(deleteAccountForm.codeRequested, { scope })
		await allSettled(deleteAccountForm.fields.code.changed, { scope, params: '654321' })
		await allSettled(deleteAccountForm.submitted, { scope })

		expect(scope.getState(deleteAccountForm.$open)).toBe(true)
		expect(scope.getState(deleteAccountForm.$step)).toBe('code')
		expect(toasts.error).toHaveBeenCalled()
	})
})
