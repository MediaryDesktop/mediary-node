import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, Input, Modal, Notice, ReelLoader, toast } from '@shared/ui'

import { installExtensionFx, previewExtensionFx, updateExtensionFx } from '@entities/extension'
import type { Extension, ExtensionPreview } from '@entities/extension'

import { languageName } from '../../lib/languages'

import styles from './InstallDialog.module.scss'

// What the dialog is for: a plugin to install — from an address typed in, or
// one picked in the catalog — or a newer version of one installed.
export type InstallTarget = { kind: 'install'; url?: string } | { kind: 'update'; extension: Extension }

export interface InstallDialogProps {
	target: InstallTarget | null
	onClose: () => void
}

export function InstallDialog({ target, onClose }: InstallDialogProps) {
	const { t } = useTranslation()

	const title =
		target?.kind === 'update'
			? t('plugins.dialog.updateTitle', { name: target.extension.name })
			: t('plugins.dialog.installTitle')

	return (
		<Modal open={target !== null} onOpenChange={open => !open && onClose()} title={title} size='md'>
			{target && (
				<Steps
					key={target.kind === 'update' ? target.extension.id : (target.url ?? '')}
					target={target}
					onClose={onClose}
				/>
			)}
		</Modal>
	)
}

// The node's own explanation of a failed request, or the fallback.
function failure(error: unknown, fallback: string): string {
	return problemDetail((error as RequestFailure['error'] | undefined) ?? {}, fallback)
}

type Step =
	| { kind: 'address' }
	| { kind: 'reading' }
	| { kind: 'consent'; preview: ExtensionPreview }
	| { kind: 'failed'; message: string }

function Steps({ target, onClose }: { target: InstallTarget; onClose: () => void }) {
	const { t } = useTranslation()
	const [preview, install, update] = useUnit([previewExtensionFx, installExtensionFx, updateExtensionFx])

	const initialURL = target.kind === 'update' ? target.extension.manifest_url : (target.url ?? '')
	const [url, setURL] = useState(initialURL)
	const [step, setStep] = useState<Step>(initialURL ? { kind: 'reading' } : { kind: 'address' })
	const [busy, setBusy] = useState(false)

	const read = (address: string) => {
		setStep({ kind: 'reading' })
		preview(address)
			.then(result => setStep({ kind: 'consent', preview: result }))
			.catch((error: unknown) =>
				setStep({ kind: 'failed', message: failure(error, t('plugins.dialog.readFailed')) })
			)
	}

	// An address from the catalog or an installed plugin is read at once; the
	// dialog starts on "reading" for it. An answer after the dialog closed is
	// dropped.
	useEffect(() => {
		if (!initialURL) {
			return
		}

		let open = true
		preview(initialURL)
			.then(result => open && setStep({ kind: 'consent', preview: result }))
			.catch(
				(error: unknown) =>
					open &&
					setStep({ kind: 'failed', message: failure(error, t('plugins.dialog.readFailed')) })
			)

		return () => {
			open = false
		}
	}, [initialURL, preview, t])

	const confirm = (previewed: ExtensionPreview) => {
		setBusy(true)
		const done =
			target.kind === 'update'
				? update({ id: target.extension.id, consent: previewed.consent })
				: install({ url: previewed.manifest_url, consent: previewed.consent })

		done.then(ext => {
			toast.success(
				target.kind === 'update'
					? t('plugins.updated', { name: ext.name, version: ext.version })
					: t('plugins.installed', { name: ext.name })
			)
			onClose()
		}).catch((error: unknown) => {
			setBusy(false)
			setStep({ kind: 'failed', message: failure(error, t('plugins.dialog.installFailed')) })
		})
	}

	if (step.kind === 'address') {
		return (
			<form
				className={styles.body}
				onSubmit={event => {
					event.preventDefault()
					if (url.trim()) {
						read(url.trim())
					}
				}}
			>
				<label className={styles.label}>
					{t('plugins.dialog.urlLabel')}
					<Input
						value={url}
						onChange={event => setURL(event.target.value)}
						placeholder='https://example.org/plugin/manifest.json'
						spellCheck={false}
						autoFocus
					/>
				</label>
				<p className={styles.hint}>{t('plugins.dialog.urlHint')}</p>
				<div className={styles.footer}>
					<Button onClick={onClose}>{t('plugins.dialog.cancel')}</Button>
					<Button type='submit' variant='primary' disabled={!url.trim()}>
						{t('plugins.dialog.next')}
					</Button>
				</div>
			</form>
		)
	}

	if (step.kind === 'reading') {
		return (
			<div className={clsx(styles.body, styles.center)}>
				<ReelLoader spinning />
				<p className={styles.hint}>{t('plugins.dialog.reading')}</p>
			</div>
		)
	}

	if (step.kind === 'failed') {
		return (
			<div className={styles.body}>
				<Notice tone='danger'>{step.message}</Notice>
				<div className={styles.footer}>
					<Button onClick={onClose}>{t('plugins.dialog.cancel')}</Button>
					<Button
						onClick={() =>
							target.kind === 'install' && !target.url
								? setStep({ kind: 'address' })
								: read(url)
						}
					>
						{t('plugins.dialog.retry')}
					</Button>
				</div>
			</div>
		)
	}

	const p = step.preview
	const before = target.kind === 'update' ? (target.extension.network ?? []) : null
	const hosts = p.network ?? []
	const settings = p.config ?? []
	const alreadyInstalled = target.kind === 'install' && Boolean(p.installed)

	return (
		<div className={styles.body}>
			<div className={styles.plugin}>
				<span className={styles.icon}>
					{p.icon ? (
						<img src={p.icon} alt='' referrerPolicy='no-referrer' />
					) : (
						p.name.slice(0, 1).toUpperCase()
					)}
				</span>
				<div className={styles.titles}>
					<p className={styles.name}>
						{p.name} <span className={styles.version}>{p.version}</span>
					</p>
					<p className={styles.byline}>
						{[p.author, languageName(p.lang, t('plugins.multiLanguage'))]
							.filter(Boolean)
							.join(' · ')}
					</p>
				</div>
			</div>

			{p.description && <p className={styles.description}>{p.description}</p>}

			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>{t('plugins.dialog.hostsTitle')}</h3>
				{hosts.length === 0 ? (
					<p className={styles.hint}>{t('plugins.dialog.hostsNone')}</p>
				) : (
					<ul className={styles.hosts}>
						{hosts.map(host => (
							<li key={host} className={clsx(before && !before.includes(host) && styles.added)}>
								{host}
								{before && !before.includes(host) && (
									<span className={styles.tag}>{t('plugins.dialog.hostsNew')}</span>
								)}
							</li>
						))}
					</ul>
				)}
			</section>

			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>{t('plugins.dialog.receivesTitle')}</h3>
				<p className={styles.hint}>{t('plugins.dialog.receives')}</p>
			</section>

			{settings.length > 0 && (
				<section className={styles.section}>
					<h3 className={styles.sectionTitle}>{t('plugins.dialog.settingsTitle')}</h3>
					<ul className={styles.settings}>
						{settings.map(field => (
							<li key={field.name}>
								{field.label}
								{field.secret && (
									<span className={styles.tag}>{t('plugins.dialog.secret')}</span>
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			<p className={styles.sandbox}>{t('plugins.dialog.sandbox')}</p>

			<p className={styles.source} title={p.manifest_url}>
				{t('plugins.dialog.source')}: {p.manifest_url}
			</p>

			{!p.compatible && (
				<Notice tone='warning'>
					{t('plugins.dialog.incompatible', { version: p.min_node_version ?? '' })}
				</Notice>
			)}
			{alreadyInstalled && (
				<Notice tone='info'>
					{t('plugins.dialog.alreadyInstalled', { version: p.installed ?? '' })}
				</Notice>
			)}

			<div className={styles.footer}>
				<Button onClick={onClose} disabled={busy}>
					{t('plugins.dialog.cancel')}
				</Button>
				<Button
					variant='primary'
					loading={busy}
					disabled={!p.compatible || alreadyInstalled}
					onClick={() => confirm(p)}
				>
					{target.kind === 'update' ? t('plugins.dialog.update') : t('plugins.dialog.install')}
				</Button>
			</div>
		</div>
	)
}
