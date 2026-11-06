import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LuFilm, LuMonitorPlay, LuSearchX } from 'react-icons/lu'

import { useTranslation } from '@shared/i18n'
import { Skeleton } from '@shared/ui'

import type { Tool, ToolId } from '@entities/tool'

import { ToolCard, useTools } from '@features/manage-tools'

import { CatalogEmpty, CatalogFilters, CatalogSection } from '../catalog/Catalog'

const KINDS = ['player', 'media'] as const

type Kind = (typeof KINDS)[number]
type KindFilter = 'all' | Kind
type StatusFilter = 'all' | 'ready' | 'missing'

const KIND_OF: Record<ToolId, Kind> = {
	mpv: 'player',
	ffmpeg: 'media'
}

const KIND_ICONS: Record<Kind, ReactNode> = {
	player: <LuMonitorPlay size={20} />,
	media: <LuFilm size={20} />
}

function matches(tool: Tool, status: StatusFilter, search: string): boolean {
	if (status === 'ready' && tool.state === 'missing') {
		return false
	}
	if (status === 'missing' && tool.state !== 'missing') {
		return false
	}

	const needle = search.trim().toLowerCase()

	return (
		!needle ||
		tool.name.toLowerCase().includes(needle) ||
		(tool.programs ?? []).some(program => program.includes(needle)) ||
		tool.author.toLowerCase().includes(needle)
	)
}

export function DependenciesTab() {
	const { t } = useTranslation()

	const tools = useTools()

	const [kind, setKind] = useState<KindFilter>('all')
	const [status, setStatus] = useState<StatusFilter>('all')
	const [search, setSearch] = useState('')

	const shown = useMemo(
		() => (tools ?? []).filter(tool => matches(tool, status, search)),
		[tools, status, search]
	)

	const kinds = KINDS.filter(value => kind === 'all' || kind === value)
	const groups = kinds
		.map(value => ({ kind: value, tools: shown.filter(tool => KIND_OF[tool.id] === value) }))
		.filter(group => group.tools.length > 0)

	return (
		<>
			<CatalogFilters
				types={[
					{ value: 'all', label: t('extensions.dependencies.kinds.all') },
					...KINDS.map(value => ({ value, label: t(`extensions.dependencies.kinds.${value}`) }))
				]}
				type={kind}
				onTypeChange={setKind}
				options={(['all', 'ready', 'missing'] as const).map(value => ({
					value,
					label: t(`extensions.dependencies.statuses.${value}`)
				}))}
				option={status}
				onOptionChange={value => setStatus(value as StatusFilter)}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder={t('extensions.dependencies.search')}
			/>

			{tools === null ? (
				<Skeleton height='14rem' radius='var(--radius-lg)' />
			) : groups.length === 0 ? (
				<CatalogEmpty icon={<LuSearchX size={28} />} title={t('extensions.notFound')} />
			) : (
				groups.map(group => (
					<CatalogSection
						key={group.kind}
						icon={KIND_ICONS[group.kind]}
						title={t(`extensions.dependencies.kinds.${group.kind}`)}
					>
						{group.tools.map(tool => (
							<ToolCard key={tool.id} tool={tool} />
						))}
					</CatalogSection>
				))
			)}
		</>
	)
}
