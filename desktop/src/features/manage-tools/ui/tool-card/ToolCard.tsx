import clsx from 'clsx'
import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'
import { LuDownload, LuEllipsisVertical, LuRefreshCw, LuX } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { DropdownMenu, Icon, Logo, Notice, ProgressBar, RippleButton, Tooltip } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { cancelToolInstallMutation, installToolMutation, removeToolMutation } from '@entities/tool'
import type { Tool } from '@entities/tool'

import { ToolIcon } from '../tool-icon/ToolIcon'

import styles from './ToolCard.module.scss'

export interface ToolCardProps {
	tool: Tool
}

// One program the node runs, laid out like a marketplace card in Seanime: icon,
// name and id, what it does, version and author badges, the action in the corner.
export function ToolCard({ tool }: ToolCardProps) {
	const { t } = useTranslation()

	const [install, cancel, remove, installing, cancelling] = useUnit([
		installToolMutation.start,
		cancelToolInstallMutation.start,
		removeToolMutation.start,
		installToolMutation.$pending,
		cancelToolInstallMutation.$pending
	])

	const progress = tool.progress
	const size = tool.size ? formatBytes(tool.size) : ''

	const menu: DropdownMenuItem[] =
		tool.state === 'installed' && !progress
			? [{ id: 'remove', label: t('tools.remove'), danger: true, onSelect: () => remove(tool.id) }]
			: []

	const action = () => {
		if (progress) {
			return (
				<CornerButton label={t('tools.cancel')} disabled={cancelling} onClick={() => cancel(tool.id)}>
					<LuX size={16} />
				</CornerButton>
			)
		}

		if (tool.update) {
			return (
				<CornerButton
					label={t('tools.update', { version: tool.available ?? '' })}
					tone='success'
					disabled={installing}
					onClick={() => install(tool.id)}
				>
					<LuRefreshCw size={16} />
				</CornerButton>
			)
		}

		if (tool.state === 'installed') {
			return (
				<CornerButton label={t('tools.state.installed')} tone='done'>
					<Icon name='common/check' size={16} />
				</CornerButton>
			)
		}

		if (!tool.supported || tool.state === 'custom') {
			return null
		}

		// Found on PATH already works: the mark says so, but it is not a button —
		// there is nothing here to install or remove.
		if (tool.state === 'system') {
			return (
				<Tooltip content={t('tools.state.system')} side='left'>
					<span
						className={clsx(styles.cornerButton, styles.muted)}
						tabIndex={0}
						aria-label={t('tools.state.system')}
					>
						<Icon name='common/check' size={16} />
					</span>
				</Tooltip>
			)
		}

		const label = size ? t('tools.installSize', { size }) : t('tools.install')

		return (
			<CornerButton label={label} disabled={installing} onClick={() => install(tool.id)}>
				<LuDownload size={16} />
			</CornerButton>
		)
	}

	const version = tool.update ? `${tool.version} → ${tool.available}` : (tool.version ?? tool.available)

	return (
		<article className={clsx(styles.card, tool.update && styles.update, tool.error && styles.failed)}>
			<div className={styles.corner}>
				{action()}
				{menu.length > 0 && (
					<DropdownMenu
						align='end'
						items={menu}
						trigger={
							<RippleButton className={styles.cornerButton} aria-label={t('tools.more')}>
								<LuEllipsisVertical size={16} />
							</RippleButton>
						}
					/>
				)}
			</div>

			<div className={styles.head}>
				<span className={styles.icon}>
					<ToolIcon tool={tool.id} size={26} />
				</span>

				<div className={styles.titles}>
					<p className={styles.name} title={tool.path}>
						{tool.name}
					</p>
					<p className={styles.id}>
						{tool.state !== 'missing' && (
							<span className={styles.stateText}>{t(`tools.state.${tool.state}`)} - </span>
						)}
						<span className={styles.idText}>{(tool.programs ?? []).join(', ')}</span>
					</p>
				</div>
			</div>

			<p className={styles.description}>{t(`tools.purpose.${tool.id}`)}</p>

			{progress && (
				<div className={styles.progress}>
					<div className={styles.progressLabel}>
						<span>{t(`tools.stage.${progress.stage}`)}</span>
						{progress.stage === 'downloading' && (
							<span>
								{formatBytes(progress.done)} / {formatBytes(progress.total)}
							</span>
						)}
					</div>
					<ProgressBar
						value={progress.done}
						max={progress.stage === 'downloading' ? progress.total : null}
						label={t(`tools.stage.${progress.stage}`)}
					/>
				</div>
			)}

			{tool.error && (
				<Notice tone='danger' title={t('tools.failed')}>
					{tool.error}
				</Notice>
			)}

			{tool.state === 'custom' && (
				<p className={styles.hint}>{t('tools.customHint', { env: (tool.env ?? []).join(', ') })}</p>
			)}

			{!tool.supported && tool.state !== 'custom' && (
				<p className={styles.hint}>
					{tool.hint ? (
						<>
							{t('tools.unsupported')} <code className={styles.command}>{tool.hint}</code>
						</>
					) : (
						t('tools.unsupportedNoHint')
					)}
				</p>
			)}

			<div className={styles.meta}>
				<div className={styles.metaText}>
					{version && <span>{version}</span>}
					<span>{tool.author}</span>
					{size && <span>{size}</span>}
					{tool.update && <span className={styles.updateText}>{t('tools.updateAvailable')}</span>}
				</div>

				{/* Every program here is one Mediary picked and pins: the mark says so,
				    as opposed to a plugin someone else wrote. */}
				<Tooltip
					side='top'
					content={
						<span className={styles.officialTip}>
							<strong>{t('tools.official.title')}</strong>
							{t('tools.official.description')}
						</span>
					}
				>
					<span className={styles.official} tabIndex={0} aria-label={t('tools.official.title')}>
						<Logo markOnly iconSize={13} />
						{t('tools.official.badge')}
					</span>
				</Tooltip>
			</div>
		</article>
	)
}

interface CornerButtonProps {
	label: string
	tone?: 'primary' | 'success' | 'done'
	disabled?: boolean
	onClick?: () => void
	children: ReactNode
}

function CornerButton({ label, tone = 'primary', disabled, onClick, children }: CornerButtonProps) {
	return (
		<Tooltip content={label} side='left'>
			<RippleButton
				className={clsx(styles.cornerButton, styles[tone])}
				aria-label={label}
				disabled={disabled}
				onClick={onClick}
			>
				{children}
			</RippleButton>
		</Tooltip>
	)
}
