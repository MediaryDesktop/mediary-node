import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { Button, ConnectionCheck, Icon, Input } from '@shared/ui'

import { OPDS_KINDS } from '../../config/kinds'
import type { OPDSKind } from '../../config/kinds'
import { serverEditors } from '../../model/editor'

import styles from './ServerForm.module.scss'

export interface ServerFormProps {
	kind: OPDSKind
}

export function ServerForm({ kind }: ServerFormProps) {
	const { t } = useTranslation()
	const { text, urlPlaceholder, patronsFeed } = OPDS_KINDS[kind]
	const editor = serverEditors[kind]

	const { editing, fields, check, checking, canSubmit, submitting } = useUnit({
		editing: editor.$editing,
		fields: editor.$fields,
		check: editor.$check,
		checking: editor.$checking,
		canSubmit: editor.$canSubmit,
		submitting: editor.$submitting
	})
	const { changed, checked, submitted, closed } = useUnit({
		changed: editor.changed,
		checked: editor.checked,
		submitted: editor.submitted,
		closed: editor.closed
	})

	const server = editing?.server ?? null
	const patrons = patronsFeed !== null && fields.url.trim() === patronsFeed

	return (
		<form
			className={styles.root}
			onSubmit={event => {
				event.preventDefault()
				submitted()
			}}
		>
			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t(`${text}.drawer.nameLabel`)}</span>
					<p className={styles.hint}>{t(`${text}.drawer.nameHint`)}</p>
				</div>
				<Input
					value={fields.name}
					onChange={event => changed({ name: event.target.value })}
					disabled={submitting}
					autoComplete='off'
					maxLength={100}
					placeholder={t(`${text}.drawer.namePlaceholder`)}
				/>
			</label>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t(`${text}.drawer.urlLabel`)}</span>
					<p className={styles.hint}>{t(`${text}.drawer.description`)}</p>
				</div>
				<Input
					value={fields.url}
					onChange={event => changed({ url: event.target.value })}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
					placeholder={urlPlaceholder}
				/>
			</div>

			<label className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t(`${text}.drawer.usernameLabel`)}</span>
					<p className={styles.hint}>
						{patrons
							? t('bookSources.servers.drawer.standardUsername')
							: t(`${text}.drawer.usernameHint`)}
					</p>
				</div>
				<Input
					value={fields.username}
					onChange={event => changed({ username: event.target.value })}
					disabled={submitting}
					autoComplete='off'
					spellCheck={false}
				/>
			</label>

			<div className={styles.field}>
				<div className={styles.fieldHeader}>
					<span className={styles.label}>{t(`${text}.drawer.passwordLabel`)}</span>
					<p className={styles.hint}>
						{server?.has_password
							? t(`${text}.drawer.passwordKept`)
							: t(`${text}.drawer.passwordHint`)}
					</p>
				</div>
				<Input
					type='password'
					revealable
					value={fields.password}
					onChange={event => changed({ password: event.target.value })}
					disabled={submitting}
					autoComplete='new-password'
					startIcon={<Icon name='common/lock' size={18} />}
				/>
			</div>

			<div className={styles.footer}>
				<ConnectionCheck
					label={t(`${text}.drawer.check`)}
					size='default'
					checking={checking}
					disabled={fields.url.trim() === '' || submitting}
					onCheck={() => checked()}
					status={
						check && {
							ok: check.ok,
							message: check.ok
								? t(`${text}.drawer.ok`)
								: t(
										`${text}.drawer.problems.${check.problem ?? 'unreachable'}` as `${typeof text}.drawer.problems.unreachable`
									)
						}
					}
				/>

				<div className={styles.formActions}>
					<Button variant='secondary' onClick={() => closed()} disabled={submitting}>
						{t('common.cancel')}
					</Button>

					<Button
						type='submit'
						variant='primary'
						disabled={!canSubmit || submitting}
						loading={submitting}
					>
						{server ? t(`${text}.drawer.save`) : t(`${text}.drawer.create`)}
					</Button>
				</div>
			</div>
		</form>
	)
}
