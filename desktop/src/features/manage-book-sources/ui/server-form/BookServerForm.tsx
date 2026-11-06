import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Input, toast } from '@shared/ui'

import {
	checkBookOPDSServerMutation,
	createBookOPDSServerMutation,
	updateBookOPDSServerMutation
} from '@entities/book-source'
import type { BookOPDSCheckResult, BookOPDSServer } from '@entities/book-source'

import styles from './BookServerForm.module.scss'

const STANDARD_EBOOKS_OPDS = 'https://standardebooks.org/feeds/opds'

export interface BookServerFormProps {
	server: BookOPDSServer | null
	onDone: () => void
}

export function BookServerForm({ server, onDone }: BookServerFormProps) {
	const { t } = useTranslation()

	const [create, update, check, creating, updating, checking] = useUnit([
		createBookOPDSServerMutation.start,
		updateBookOPDSServerMutation.start,
		checkBookOPDSServerMutation.start,
		createBookOPDSServerMutation.$pending,
		updateBookOPDSServerMutation.$pending,
		checkBookOPDSServerMutation.$pending
	])

	const [name, setName] = useState(server?.name ?? '')
	const [url, setUrl] = useState(server?.url ?? '')
	const [username, setUsername] = useState(server?.username ?? '')
	const [password, setPassword] = useState('')
	const [result, setResult] = useState<BookOPDSCheckResult | null>(null)

	const submitting = creating || updating
	const canSubmit = name.trim() !== '' && url.trim() !== '' && !submitting

	const passwordValue = server && password === '' ? undefined : password

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('bookSources.servers.saveFailed')), {
			id: 'book-opds-save-failed'
		})

	useUnitWatch(createBookOPDSServerMutation.finished.success, onDone)
	useUnitWatch(updateBookOPDSServerMutation.finished.success, onDone)
	useUnitWatch(createBookOPDSServerMutation.finished.failure, failed)
	useUnitWatch(updateBookOPDSServerMutation.finished.failure, failed)
	useUnitWatch(checkBookOPDSServerMutation.finished.success, ({ result }) => setResult(result))
	useUnitWatch(checkBookOPDSServerMutation.finished.failure, () =>
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
					<span className={styles.label}>{t('bookSources.servers.drawer.nameLabel')}</span>
					<p className={styles.hint}>{t('bookSources.servers.drawer.nameHint')}</p>
				</div>
				<Input
					value={name}
					onChange={event => setName(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder={t('bookSources.servers.drawer.namePlaceholder')}
				/>
			</label>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('bookSources.servers.drawer.urlLabel')}</span>
					<p className={styles.hint}>{t('bookSources.servers.drawer.description')}</p>
				</div>
				<Input
					value={url}
					onChange={event => setUrl(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder='http://nas:8083/opds'
				/>
			</div>

			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t('bookSources.servers.drawer.usernameLabel')}</span>
					<p className={styles.hint}>
						{url.trim() === STANDARD_EBOOKS_OPDS
							? t('bookSources.servers.drawer.standardUsername')
							: t('bookSources.servers.drawer.usernameHint')}
					</p>
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
					<span className={styles.label}>{t('bookSources.servers.drawer.passwordLabel')}</span>
					<p className={styles.hint}>
						{server?.has_password
							? t('bookSources.servers.drawer.passwordKept')
							: t('bookSources.servers.drawer.passwordHint')}
					</p>
				</div>
				<Input
					type='password'
					revealable
					value={password}
					onChange={event => setPassword(event.target.value)}
					disabled={submitting}
					autoComplete='new-password'
				/>
			</div>

			<div className={styles.footer}>
				<ConnectionCheck
					label={t('bookSources.servers.drawer.check')}
					size='default'
					checking={checking}
					disabled={url.trim() === '' || submitting}
					onCheck={runCheck}
					status={
						result && {
							ok: result.ok,
							message: result.ok
								? t('bookSources.servers.drawer.ok')
								: t(`bookSources.servers.drawer.problems.${result.problem ?? 'unreachable'}`)
						}
					}
				/>

				<div className={styles.formActions}>
					<Button variant='secondary' onClick={onDone} disabled={submitting}>
						{t('common.cancel')}
					</Button>

					<Button type='submit' variant='primary' disabled={!canSubmit} loading={submitting}>
						{server
							? t('bookSources.servers.drawer.save')
							: t('bookSources.servers.drawer.create')}
					</Button>
				</div>
			</div>
		</form>
	)
}
