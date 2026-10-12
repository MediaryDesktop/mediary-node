import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { ConnectionCheck, Drawer, DrawerForm, DrawerSection, Input, toast } from '@shared/ui'

import {
	checkOPDSServerMutation,
	createOPDSServerMutation,
	updateOPDSServerMutation
} from '@entities/manga-source'
import type { OPDSCheckResult, OPDSServer } from '@entities/manga-source'

export interface OPDSServerDrawerProps {
	open: boolean
	// The server being changed, or null to add one.
	server: OPDSServer | null
	onClose: () => void
}

// The form is mounted afresh for every opening, so its fields start from the server.
export function OPDSServerDrawer({ open, server, onClose }: OPDSServerDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={server ? t('mangaSources.drawer.editTitle') : t('mangaSources.drawer.createTitle')}
			description={t('mangaSources.drawer.description')}
			closable={false}
		>
			{open && <ServerForm key={server?.id ?? 'new'} server={server} onDone={onClose} />}
		</Drawer>
	)
}

function ServerForm({ server, onDone }: { server: OPDSServer | null; onDone: () => void }) {
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

	// Only one form is open at a time, so whatever these mutations report is this form's.
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
		<DrawerForm
			onSubmit={submit}
			onCancel={onDone}
			submitLabel={server ? t('mangaSources.drawer.save') : t('mangaSources.drawer.create')}
			submitDisabled={!canSubmit}
			cancelDisabled={submitting}
			submitting={submitting}
		>
			<DrawerSection title={t('mangaSources.drawer.nameLabel')}>
				<Input
					value={name}
					onChange={event => setName(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder={t('mangaSources.drawer.namePlaceholder')}
				/>
			</DrawerSection>

			<DrawerSection title={t('mangaSources.drawer.urlLabel')}>
				<Input
					value={url}
					onChange={event => setUrl(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder='http://nas:25600/opds/v1.2/catalog'
				/>
			</DrawerSection>

			<DrawerSection title={t('mangaSources.drawer.usernameLabel')}>
				<Input
					value={username}
					onChange={event => setUsername(event.target.value)}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
				/>
			</DrawerSection>

			<DrawerSection
				title={t('mangaSources.drawer.passwordLabel')}
				description={
					server?.has_password
						? t('mangaSources.drawer.passwordKept')
						: t('mangaSources.drawer.passwordHint')
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
					label={t('mangaSources.drawer.check')}
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
			</DrawerSection>
		</DrawerForm>
	)
}
