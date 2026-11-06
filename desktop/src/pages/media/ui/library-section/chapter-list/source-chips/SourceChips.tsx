import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, RippleButton } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import type { MangaLink } from '@entities/manga-source'

import { SourceIcon } from '../source-icon/SourceIcon'

import styles from './SourceChips.module.scss'

export interface SourceChipsProps {
	sources: Map<string, string>
	counts: Map<string, number>
	total: number
	icons: Map<string, string>
	allValue: string
	active: string
	onFilter: (value: string) => void
	links: MangaLink[]
	onRelink: (source: string) => void
	onUnlink: (source: string) => void
}

export function SourceChips({
	sources,
	counts,
	total,
	icons,
	allValue,
	active,
	onFilter,
	links,
	onRelink,
	onUnlink
}: SourceChipsProps) {
	const { t } = useTranslation()
	const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)

	const linkBySource = new Map(links.map(link => [link.source, link]))

	const chip = (value: string, label: string, count: number, icon?: ReactNode) => {
		const link = linkBySource.get(value)
		const menu: DropdownMenuItem[] | undefined = link && [
			{
				id: `relink:${link.source}`,
				label: t('mangaSources.chapters.relinkFrom', { name: link.source_name }),
				icon: 'common/search',
				onSelect: () => onRelink(link.source)
			},
			{
				id: `unlink:${link.source}`,
				label: t('mangaSources.chapters.unlinkFrom', { name: link.source_name }),
				icon: 'common/trash',
				danger: true,
				onSelect: () => onUnlink(link.source)
			}
		]

		return (
			<div
				key={value}
				role='button'
				tabIndex={0}
				aria-pressed={value === active}
				className={clsx(
					styles.chip,
					value === active && styles.active,
					menuOpenFor === value && styles.menuOpen
				)}
				onClick={() => onFilter(value)}
				onKeyDown={event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						onFilter(value)
					}
				}}
			>
				{icon}
				<span className={styles.text}>
					<span className={styles.label}>{label}</span>
					<span className={styles.count}>{count}</span>
				</span>

				{menu && (
					<DropdownMenu
						items={menu}
						align='end'
						onOpenChange={open => setMenuOpenFor(open ? value : null)}
						trigger={
							<RippleButton
								className={styles.more}
								aria-label={t('mangaSources.chapters.links')}
								title={t('mangaSources.chapters.links')}
								onClick={event => event.stopPropagation()}
							>
								<Icon name='common/more-vertical' size={16} />
							</RippleButton>
						}
					/>
				)}
			</div>
		)
	}

	return (
		<div className={styles.chips} role='group' aria-label={t('mangaSources.chapters.filter')}>
			{sources.size > 1 && chip(allValue, t('mangaSources.chapters.all'), total)}

			{[...sources].map(([value, name]) =>
				chip(
					value,
					name,
					counts.get(value) ?? 0,
					<SourceIcon source={value} name={name} image={icons.get(value)} />
				)
			)}
		</div>
	)
}
