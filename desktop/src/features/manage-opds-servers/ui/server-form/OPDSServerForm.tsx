import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Icon, Input, toast } from '@shared/ui'

import {
	checkOPDSServerMutation,
	createOPDSServerMutation,
	updateOPDSServerMutation
} from '@entities/manga-source'
import type { OPDSCheckResult, OPDSServer } from '@entities/manga-source'

import styles from './OPDSServerForm.module.scss'

export interface OPDSServerFormProps {
	// The server being changed, or null to add one.
	server: OPDSServer | null
	// Called after a successful save, and when the user cancels: either way the
	// form's local state should go back to matching what is saved.
	onDone: () => void
}

// Mounted afresh for every opening, so its fields start from the server.
export function OPDSServerForm({ server, onDone }: OPDSServerFormProps) {
	const { t } = useTranslation()

	const [create, update, check, creating, updating, checking] = useUnit([
		createOPDSServerMutation.start,
		updateOPDSServerMutation.start,
		checkOPDSServerMutation.start,
		createOPDSServerMutation.$pending,
		updateOPDSServerMutation.$pending,
		checkOPDSServerMutation.$pending
	])

	const [name, setName] = useState(server?.name ?? '')
	const [url, setUrl] = useState(server?.url ?? '')
	const [username, setUsername] = useState(server?.username ?? '')
	const [password, setPassword] = useState('')
	const [result, setResult] = useState<OPDSCheckResult | null>(null)

	const submitting = creating || updating
	const canSubmit = name.trim() !== '' && url.trim() !== '' && !submitting

	// An untouched password field on an existing server keeps the stored password.
	const passwordValue = server && password === '' ? undefined : password

	// Only one form is mounted at a time, so whatever these mutations report is this form's.
	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('mangaSources.saveFailed')), { id: 'opds-save-failed' })

	useUnitWatch(createOPDSServerMutation.finished.success, onDone)
	useUnitWatch(updateOPDSServerMutation.finished.success, onDone)
	useUnitWatch(createOPDSServerMutation.finished.failure, failed)
	useUnitWatch(updateOPDSServerMutation.finished.failure, failed)
	useUnitWatch(checkOPDSServerMutation.finished.success, ({ result }) => setResult(result))
	useUnitWatch(checkOPDSServerMutation.finished.failure, () =>
		setResult({ ok: false, problem: 'unreachable' })
	)

	const runCheck = () => {
		setResult(null)
		check({ server_id: server?.id, url, username, password: passwordValue })
	}

	const submit = () => {
		const body = { name, url, username, password: passwordValue }

		if (server) {
			update({ id: server.id, body })
		} else {
			create(body)
		}
	}

	return (
		<form
			className={styles.root}
			onSubmit={event => {
				event.preventDefault()
				submit()
			}}
		>
			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('mangaSources.drawer.nameLabel')}</span>
					<p className={styles.hint}>{t('mangaSources.drawer.nameHint')}</p>
				</div>
				<Input
					value={name}
					onChange={event => setName(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder={t('mangaSources.drawer.namePlaceholder')}
				/>
			</label>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('mangaSources.drawer.urlLabel')}</span>
					<p className={styles.hint}>{t('mangaSources.drawer.description')}</p>
				</div>
				<Input
					value={url}
					onChange={event => setUrl(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder='http://nas:25600/opds/v1.2/catalog'
				/>
			</div>

			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('mangaSources.drawer.usernameLabel')}</span>
					<p className={styles.hint}>{t('mangaSources.drawer.usernameHint')}</p>
				</div>
				<Input
					value={username}
					onChange={event => setUsername(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
				/>
			</label>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('mangaSources.drawer.passwordLabel')}</span>
					<p className={styles.hint}>
						{server?.has_password
							? t('mangaSources.drawer.passwordKept')
							: t('mangaSources.drawer.passwordHint')}
					</p>
				</div>
				<Input
					type='password'
					revealable
					value={password}
					onChange={event => setPassword(event.target.value)}
					disabled={submitting}
					autoComplete='new-password'
					startIcon={<Icon name='common/lock' size={18} />}
				/>
			</div>

			<div className={styles.footer}>
				<ConnectionCheck
					label={t('mangaSources.drawer.check')}
					size='default'
					checking={checking}
					disabled={url.trim() === '' || submitting}
					onCheck={runCheck}
					status={
						result && {
							ok: result.ok,
							message: result.ok
								? t('mangaSources.drawer.ok')
								: t(`mangaSources.drawer.problems.${result.problem ?? 'unreachable'}`)
						}
					}
				/>

				<div className={styles.formActions}>
					<Button variant='secondary' onClick={onDone} disabled={submitting}>
						{t('common.cancel')}
					</Button>

					<Button type='submit' variant='primary' disabled={!canSubmit} loading={submitting}>
						{server ? t('mangaSources.drawer.save') : t('mangaSources.drawer.create')}
					</Button>
				</div>
			</div>
		</form>
	)
}
