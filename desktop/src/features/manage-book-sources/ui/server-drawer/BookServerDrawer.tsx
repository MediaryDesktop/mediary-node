import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Drawer, DrawerForm, DrawerSection, Input, toast } from '@shared/ui'

import {
	checkBookOPDSServerMutation,
	createBookOPDSServerMutation,
	updateBookOPDSServerMutation
} from '@entities/book-source'
import type { BookOPDSCheckResult, BookOPDSServer } from '@entities/book-source'

import styles from './BookServerDrawer.module.scss'

// Standard Ebooks opens its OPDS feed to members of its Patrons Circle, who sign
// in with their e-mail and no password.
const STANDARD_EBOOKS_OPDS = 'https://standardebooks.org/feeds/opds'
const STANDARD_EBOOKS_FEEDS = 'https://standardebooks.org/feeds'

export interface BookServerDrawerProps {
	open: boolean
	// The server being changed, or null to add one.
	server: BookOPDSServer | null
	onClose: () => void
}

// The same form as for manga servers, with Standard Ebooks spelt out: its
// patrons sign in by e-mail alone. The form is mounted afresh for every
// opening, so its fields start from the server.
export function BookServerDrawer({ open, server, onClose }: BookServerDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={
				server
					? t('bookSources.servers.drawer.editTitle')
					: t('bookSources.servers.drawer.createTitle')
			}
			description={t('bookSources.servers.drawer.description')}
			closable={false}
		>
			{open && <ServerForm key={server?.id ?? 'new'} server={server} onDone={onClose} />}
		</Drawer>
	)
}

function ServerForm({ server, onDone }: { server: BookOPDSServer | null; onDone: () => void }) {
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

	// An untouched password field on an existing server keeps the stored password.
	const passwordValue = server && password === '' ? undefined : password

	// Only one form is open at a time, so whatever these mutations report is this form's.
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
		<DrawerForm
			onSubmit={submit}
			onCancel={onDone}
			submitLabel={
				server ? t('bookSources.servers.drawer.save') : t('bookSources.servers.drawer.create')
			}
			submitDisabled={!canSubmit}
			cancelDisabled={submitting}
			submitting={submitting}
		>
			{!server && (
				<DrawerSection title={t('bookSources.servers.drawer.standardTitle')}>
					<div className={styles.standard}>
						<p className={styles.hint}>
							{t('bookSources.servers.drawer.standardHint')}{' '}
							<a href={STANDARD_EBOOKS_FEEDS} target='_blank' rel='noreferrer'>
								{t('bookSources.servers.drawer.standardLink')}
							</a>
						</p>
						<Button
							size='small'
							disabled={submitting}
							onClick={() => {
								setName('Standard Ebooks')
								setUrl(STANDARD_EBOOKS_OPDS)
								setPassword('')
							}}
						>
							{t('bookSources.servers.drawer.standardFill')}
						</Button>
					</div>
				</DrawerSection>
			)}

			<DrawerSection title={t('bookSources.servers.drawer.nameLabel')}>
				<Input
					value={name}
					onChange={event => setName(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder={t('bookSources.servers.drawer.namePlaceholder')}
				/>
			</DrawerSection>

			<DrawerSection title={t('bookSources.servers.drawer.urlLabel')}>
				<Input
					value={url}
					onChange={event => setUrl(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder='http://nas:8083/opds'
				/>
			</DrawerSection>

			<DrawerSection
				title={t('bookSources.servers.drawer.usernameLabel')}
				description={
					url.trim() === STANDARD_EBOOKS_OPDS
						? t('bookSources.servers.drawer.standardUsername')
						: undefined
				}
			>
				<Input
					value={username}
					onChange={event => setUsername(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
				/>
			</DrawerSection>

			<DrawerSection
				title={t('bookSources.servers.drawer.passwordLabel')}
				description={
					server?.has_password
						? t('bookSources.servers.drawer.passwordKept')
						: t('bookSources.servers.drawer.passwordHint')
				}
			>
				<Input
					type='password'
					revealable
					value={password}
					onChange={event => setPassword(event.target.value)}
					disabled={submitting}
					autoComplete='new-password'
				/>
			</DrawerSection>

			<DrawerSection>
				<ConnectionCheck
					label={t('bookSources.servers.drawer.check')}
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
			</DrawerSection>
		</DrawerForm>
	)
}
