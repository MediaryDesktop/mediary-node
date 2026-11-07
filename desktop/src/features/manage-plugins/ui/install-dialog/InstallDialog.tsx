import { useUnit } from 'effector-react'
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { LuDownload, LuRefreshCw } from 'react-icons/lu'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { Button, Input, Modal, Notice, ReelLoader, toast } from '@shared/ui'

import { installExtensionFx, previewExtensionFx, updateExtensionFx } from '@entities/extension'
import type { Extension, ExtensionPreview } from '@entities/extension'

import { Consent } from './consent/Consent'
import styles from './InstallDialog.module.scss'
import { ManifestAddress } from './manifest-address/ManifestAddress'

export type InstallTarget = { kind: 'install'; url?: string } | { kind: 'update'; extension: Extension }

export interface InstallDialogProps {
	target: InstallTarget | null
	onClose: () => void
}

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
