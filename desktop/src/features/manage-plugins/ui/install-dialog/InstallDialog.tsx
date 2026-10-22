import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import {
	LuCheck,
	LuCopy,
	LuDownload,
	LuGlobe,
	LuRefreshCw,
	LuShieldCheck,
	LuSlidersHorizontal,
	LuTag,
	LuX
} from 'react-icons/lu'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, Input, Modal, Notice, ReelLoader, toast, Tooltip } from '@shared/ui'

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

// The last target stays on screen while the dialog closes, so the closing
// animation shows what was there rather than an empty box. Every new target
// starts the steps over.
export function InstallDialog({ target, onClose }: InstallDialogProps) {
	const [shown, setShown] = useState(target)
	const [generation, setGeneration] = useState(0)

	if (target && target !== shown) {
		setShown(target)
		setGeneration(generation + 1)
	}

	if (!shown) {
		return null
	}

	return <Steps key={generation} target={shown} open={target !== null} onClose={onClose} />
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

interface StepsProps {
	target: InstallTarget
	open: boolean
	onClose: () => void
}

function Steps({ target, open, onClose }: StepsProps) {
	const { t } = useTranslation()
	const formId = useId()
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

		let alive = true
		preview(initialURL)
			.then(result => alive && setStep({ kind: 'consent', preview: result }))
			.catch(
				(error: unknown) =>
					alive &&
					setStep({ kind: 'failed', message: failure(error, t('plugins.dialog.readFailed')) })
			)

		return () => {
			alive = false
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

	const cancel = (
		<Button onClick={onClose} disabled={busy}>
			{t('plugins.dialog.cancel')}
		</Button>
	)

	const view = (): { body: ReactNode; footer: ReactNode } => {
		switch (step.kind) {
			case 'address':
				return {
					body: (
						<form
							id={formId}
							className={styles.address}
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
						</form>
					),
					footer: (
						<>
							{cancel}
							<Button type='submit' form={formId} variant='primary' disabled={!url.trim()}>
								{t('plugins.dialog.next')}
							</Button>
						</>
					)
				}

			case 'reading':
				return {
					body: (
						<div className={styles.reading}>
							<ReelLoader spinning />
							<p className={styles.hint}>{t('plugins.dialog.reading')}</p>
						</div>
					),
					footer: cancel
				}

			case 'failed':
				return {
					body: <Notice tone='danger'>{step.message}</Notice>,
					footer: (
						<>
							{cancel}
							<Button
								onClick={() =>
									target.kind === 'install' && !target.url
										? setStep({ kind: 'address' })
										: read(url)
								}
							>
								{t('plugins.dialog.retry')}
							</Button>
						</>
					)
				}

			case 'consent':
				return consentView(step.preview)
		}
	}

	const consentView = (p: ExtensionPreview) => {
		const alreadyInstalled = target.kind === 'install' && Boolean(p.installed)

		return {
			body: (
				<Consent
					preview={p}
					before={target.kind === 'update' ? (target.extension.network ?? []) : null}
					alreadyInstalled={alreadyInstalled}
				/>
			),
			footer: (
				<>
					<ManifestAddress url={p.manifest_url} />
					{cancel}
					<Button
						variant='primary'
						loading={busy}
						disabled={!p.compatible || alreadyInstalled}
						startIcon={
							target.kind === 'update' ? <LuRefreshCw size={16} /> : <LuDownload size={16} />
						}
						onClick={() => confirm(p)}
					>
						{target.kind === 'update' ? t('plugins.dialog.update') : t('plugins.dialog.install')}
					</Button>
				</>
			)
		}
	}

	const { body, footer } = view()

	return (
		<Modal
			open={open}
			onOpenChange={next => !next && onClose()}
			title={
				target.kind === 'update'
					? t('plugins.dialog.updateTitle', { name: target.extension.name })
					: t('plugins.dialog.installTitle')
			}
			size='md'
			footer={footer}
		>
			{body}
		</Modal>
	)
}

interface ConsentProps {
	preview: ExtensionPreview
	// The hosts the installed version reaches, when this is an update: the ones
	// not among them are marked new.
	before: string[] | null
	alreadyInstalled: boolean
}

// Everything the user agrees to, in the order it matters: who the plugin is,
// where it goes, what it gets, what it asks for, and what it cannot do.
function Consent({ preview: p, before, alreadyInstalled }: ConsentProps) {
	const { t } = useTranslation()
	const [broken, setBroken] = useState(false)

	const hosts = p.network ?? []
	const settings = p.config ?? []

	return (
		<div className={styles.consent}>
			<div className={styles.plugin}>
				<span className={styles.icon}>
					{p.icon && !broken ? (
						<img
							src={p.icon}
							alt=''
							referrerPolicy='no-referrer'
							onError={() => setBroken(true)}
						/>
					) : (
						p.name.slice(0, 1).toUpperCase()
					)}
				</span>
				<div className={styles.titles}>
					<p className={styles.name}>{p.name}</p>
					<p className={styles.byline}>
						{[`v${p.version}`, p.author, languageName(p.lang, t('plugins.multiLanguage'))]
							.filter(Boolean)
							.join(' · ')}
					</p>
				</div>
			</div>

			{p.description && <p className={styles.description}>{p.description}</p>}

			<ul className={styles.facts}>
				<Fact
					icon={<LuGlobe size={18} />}
					tone='info'
					title={
						hosts.length > 0
							? t('plugins.dialog.hosts', { count: hosts.length })
							: t('plugins.dialog.hostsNone')
					}
				>
					{hosts.length > 0 ? (
						<ul className={styles.chips}>
							{hosts.map(host => {
								const added = before !== null && !before.includes(host)

								return (
									<li key={host} className={clsx(styles.host, added && styles.added)}>
										{host}
										{added && (
											<span className={styles.tag}>{t('plugins.dialog.hostsNew')}</span>
										)}
									</li>
								)
							})}
						</ul>
					) : (
						<p className={styles.text}>{t('plugins.dialog.hostsNoneHint')}</p>
					)}
				</Fact>

				<Fact icon={<LuTag size={18} />} tone='warning' title={t('plugins.dialog.receivesTitle')}>
					<p className={styles.text}>{t('plugins.dialog.receives')}</p>
					<p className={styles.private}>
						<LuCheck size={14} />
						{t('plugins.dialog.receivesPrivate')}
					</p>
				</Fact>

				{settings.length > 0 && (
					<Fact
						icon={<LuSlidersHorizontal size={18} />}
						tone='purple'
						title={t('plugins.dialog.settings', { count: settings.length })}
					>
						<ul className={styles.chips}>
							{settings.map(field => (
								<li key={field.name} className={styles.setting}>
									{field.label}
									{field.secret && (
										<span className={styles.tag}>{t('plugins.dialog.secret')}</span>
									)}
								</li>
							))}
						</ul>
					</Fact>
				)}
			</ul>

			<div className={styles.sandbox}>
				<p className={styles.sandboxTitle}>
					<LuShieldCheck size={18} />
					{t('plugins.dialog.sandboxTitle')}
				</p>
				<ul className={styles.sandboxList}>
					{(
						[
							'plugins.dialog.sandboxFiles',
							'plugins.dialog.sandboxSites',
							'plugins.dialog.sandboxPrograms',
							'plugins.dialog.sandboxNetwork'
						] as const
					).map(key => (
						<li key={key}>
							<LuX size={13} />
							{t(key)}
						</li>
					))}
				</ul>
				<p className={styles.sandboxNote}>{t('plugins.dialog.sandboxNote')}</p>
			</div>

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
		</div>
	)
}

interface FactProps {
	icon: ReactNode
	tone: 'info' | 'warning' | 'purple'
	title: string
	children: ReactNode
}

function Fact({ icon, tone, title, children }: FactProps) {
	return (
		<li className={styles.fact}>
			<span className={clsx(styles.factIcon, styles[tone])}>{icon}</span>
			<div className={styles.factBody}>
				<p className={styles.factTitle}>{title}</p>
				{children}
			</div>
		</li>
	)
}

// The manifest's address, short enough to fit beside the buttons; the whole of
// it is in the tooltip and one click away on the clipboard.
function ManifestAddress({ url }: { url: string }) {
	const { t } = useTranslation()

	const copy = () => {
		navigator.clipboard
			.writeText(url)
			.then(() => toast.success(t('plugins.dialog.copied'), { duration: 1500 }))
			.catch(() => undefined)
	}

	return (
		<div className={styles.manifest}>
			<span className={styles.manifestLabel}>{t('plugins.dialog.source')}</span>
			<div className={styles.manifestRow}>
				<span className={styles.manifestUrl} title={url}>
					{url.replace(/^https:\/\//u, '')}
				</span>
				<Tooltip content={t('plugins.dialog.copy')}>
					<button
						type='button'
						className={styles.copy}
						aria-label={t('plugins.dialog.copy')}
						onClick={copy}
					>
						<LuCopy size={12} />
					</button>
				</Tooltip>
			</div>
		</div>
	)
}
