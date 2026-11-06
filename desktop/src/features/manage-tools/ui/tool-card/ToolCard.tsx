import { useUnit } from 'effector-react'
import { LuDownload, LuEllipsisVertical, LuRefreshCw, LuX } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import {
	DropdownMenu,
	Icon,
	ItemCard,
	ItemCardAction,
	ItemCardMark,
	Logo,
	Notice,
	ProgressBar,
	Tooltip
} from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import { cancelToolInstallMutation, installToolMutation, removeToolMutation } from '@entities/tool'
import type { Tool } from '@entities/tool'

import { ToolIcon } from '../tool-icon/ToolIcon'

import styles from './ToolCard.module.scss'

export interface ToolCardProps {
	tool: Tool
}

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
				<ItemCardAction
					label={t('tools.cancel')}
					tone='primary'
					disabled={cancelling}
					onClick={() => cancel(tool.id)}
				>
					<LuX size={16} />
				</ItemCardAction>
			)
		}

		if (tool.update) {
			return (
				<ItemCardAction
					label={t('tools.update', { version: tool.available ?? '' })}
					tone='success'
					disabled={installing}
					onClick={() => install(tool.id)}
				>
					<LuRefreshCw size={16} />
				</ItemCardAction>
			)
		}

		if (tool.state === 'installed' || tool.state === 'system') {
			return (
				<ItemCardMark label={t(`tools.state.${tool.state}`)}>
					<Icon name='common/check' size={16} />
				</ItemCardMark>
			)
		}

		if (!tool.supported || tool.state === 'custom') {
			return null
		}

		const label = size ? t('tools.installSize', { size }) : t('tools.install')

		return (
			<ItemCardAction
				label={label}
				tone='primary'
				disabled={installing}
				onClick={() => install(tool.id)}
			>
				<LuDownload size={16} />
			</ItemCardAction>
		)
	}

	const version = tool.update ? `${tool.version} → ${tool.available}` : (tool.version ?? tool.available)

	return (
		<ItemCard
			icon={<ToolIcon tool={tool.id} size={26} />}
			title={tool.name}
			titleHint={tool.path}
			subtitle={
				<>
					{tool.state !== 'missing' && (
						<span className={styles.stateText}>{t(`tools.state.${tool.state}`)} - </span>
					)}
					{(tool.programs ?? []).join(', ')}
				</>
			}
			description={t(`tools.purpose.${tool.id}`)}
			highlight={tool.error ? 'warning' : tool.update ? 'success' : undefined}
			meta={[
				version,
				tool.author,
				size,
				tool.update && <span className={styles.updateText}>{t('tools.updateAvailable')}</span>
			]}
			badge={
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
			}
			actions={
				<>
					{action()}
					{menu.length > 0 && (
						<DropdownMenu
							align='end'
							items={menu}
							trigger={
								<ItemCardAction label={t('tools.more')} tooltip={false}>
									<LuEllipsisVertical size={16} />
								</ItemCardAction>
							}
						/>
					)}
				</>
			}
		>
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
		</ItemCard>
	)
}
