import clsx from 'clsx'
import type { ReactNode } from 'react'

import { useTranslation } from '@shared/i18n'
import { DropdownMenu, Icon, RippleButton } from '@shared/ui'
import type { DropdownMenuItem } from '@shared/ui'

import type { MangaLink } from '@entities/manga-source'

import { SourceIcon } from '../source-icon/SourceIcon'

import styles from './SourceChips.module.scss'

export interface SourceChipsProps {
	// Every source the list holds, by id, with its name.
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

// Which source the list shows, and a menu for the series each one is linked to.
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

	const linkItems: DropdownMenuItem[] = links.flatMap(link => [
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
	])

	const chip = (value: string, label: string, count: number, icon?: ReactNode) => (
		<RippleButton
			key={value}
			className={clsx(styles.chip, value === active && styles.active)}
			aria-pressed={value === active}
			onClick={() => onFilter(value)}
		>
			{icon}
			<span className={styles.label}>{label}</span>
			<span className={styles.count}>{count}</span>
		</RippleButton>
	)

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

			{linkItems.length > 0 && (
				<DropdownMenu
					items={linkItems}
					align='end'
					trigger={
						<RippleButton
							className={styles.links}
							aria-label={t('mangaSources.chapters.links')}
							title={t('mangaSources.chapters.links')}
						>
							<Icon name='common/link' size={16} />
						</RippleButton>
					}
				/>
			)}
		</div>
	)
}
