import type { ReactNode } from 'react'
import { LuSearch } from 'react-icons/lu'

import { Input, SelectDropdown } from '@shared/ui'
import type { SelectDropdownOption } from '@shared/ui'

import styles from './Catalog.module.scss'


export interface CatalogFiltersProps<Type extends string> {
	types: readonly { value: Type; label: string }[]
	type: Type
	onTypeChange: (type: Type) => void

	options: SelectDropdownOption[]
	option: string
	onOptionChange: (option: string) => void

	search: string
	onSearchChange: (search: string) => void
	searchPlaceholder: string
}

export function CatalogFilters<Type extends string>({
	types,
	type,
	onTypeChange,
	options,
	option,
	onOptionChange,
	search,
	onSearchChange,
	searchPlaceholder
}: CatalogFiltersProps<Type>) {
	return (
		<div className={styles.filters}>
			<SelectDropdown
				className={styles.select}
				options={[...types]}
				value={type}
				onChange={value => onTypeChange((value as Type | null) ?? types[0]?.value ?? type)}
			/>
			<SelectDropdown
				className={styles.select}
				options={options}
				value={option}
				onChange={value => onOptionChange(value ?? options[0]?.value ?? '')}
			/>
			<Input
				className={styles.search}
				value={search}
				onChange={event => onSearchChange(event.target.value)}
				placeholder={searchPlaceholder}
				startIcon={<LuSearch size={18} />}
			/>
		</div>
	)
}

export interface CatalogSectionProps {
	icon: ReactNode
	title: string
	children: ReactNode
}

export function CatalogSection({ icon, title, children }: CatalogSectionProps) {
	return (
		<section className={styles.section}>
			<h2 className={styles.sectionTitle}>
				{icon}
				{title}
			</h2>

			<div className={styles.grid}>{children}</div>
		</section>
	)
}

export interface CatalogEmptyProps {
	icon: ReactNode
	title: string
	description?: string
	actions?: ReactNode
}

export function CatalogEmpty({ icon, title, description, actions }: CatalogEmptyProps) {
	return (
		<div className={styles.empty}>
			<span className={styles.emptyIcon}>{icon}</span>
			<p className={styles.emptyTitle}>{title}</p>
			{description && <p className={styles.emptyDescription}>{description}</p>}
			{actions && <div className={styles.emptyActions}>{actions}</div>}
		</div>
	)
}
