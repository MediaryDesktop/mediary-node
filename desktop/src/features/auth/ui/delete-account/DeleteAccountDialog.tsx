import { useUnit } from 'effector-react'
import type { FormEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Modal, OtpInput } from '@shared/ui'

import { sessionModel } from '@entities/session'

import { useOtpCountdown } from '../../lib'
import { deleteAccountForm } from '../../model'
import { CODE_LENGTH } from '../../validation'
import { AuthLink, OtpCountdownTimer } from '../common'

import styles from './DeleteAccountDialog.module.scss'

const FORM_ID = 'delete-account'

export function DeleteAccountDialog() {
	const { t } = useTranslation()
	const [open, step, code, pending, codePending, expiresAt, account] = useUnit([
		deleteAccountForm.$open,
		deleteAccountForm.$step,
		deleteAccountForm.fields.code.$value,
		deleteAccountForm.$pending,
		deleteAccountForm.$codePending,
		deleteAccountForm.$expiresAt,
		sessionModel.$account
	])
	const { known, expired, formatted } = useOtpCountdown(expiresAt)

	const submit = (event: FormEvent) => {
		event.preventDefault()
		deleteAccountForm.submitted()
	}

	const cancel = (
		<Button variant='ghost' onClick={() => deleteAccountForm.closed()}>
			{t('auth.deleteAccount.cancel')}
		</Button>
	)

	return (
		<Modal
			open={open}
			onOpenChange={next => (next ? deleteAccountForm.opened() : deleteAccountForm.closed())}
			title={t('auth.deleteAccount.title')}
			description={t('auth.deleteAccount.warning')}
			size='sm'
			footer={
				step === 'warning' ? (
					<>
						{cancel}
						<Button
							variant='primary'
							loading={codePending}
							onClick={() => deleteAccountForm.codeRequested()}
						>
							{t('auth.deleteAccount.sendCode')}
						</Button>
					</>
				) : (
					<>
						{cancel}
						<Button type='submit' form={FORM_ID} variant='primary' loading={pending}>
							{t('auth.deleteAccount.confirm')}
						</Button>
					</>
				)
			}
		>
			{step === 'code' && (
				<form id={FORM_ID} className={styles.form} onSubmit={submit} noValidate>
					<p className={styles.hint}>
						{t('auth.deleteAccount.codeHint', {
							length: CODE_LENGTH,
							email: account?.email ?? ''
						})}
					</p>

					<OtpInput
						value={code}
						length={CODE_LENGTH}
						disabled={pending}
						aria-label={t('auth.field.code')}
						onChange={deleteAccountForm.fields.code.changed}
					/>

					<p className={styles.resend}>
						<AuthLink onClick={() => deleteAccountForm.codeRequested()} disabled={codePending}>
							{t('auth.deleteAccount.resend')}
						</AuthLink>
						{known && <OtpCountdownTimer expired={expired} formatted={formatted} />}
					</p>
				</form>
			)}
		</Modal>
	)
}
