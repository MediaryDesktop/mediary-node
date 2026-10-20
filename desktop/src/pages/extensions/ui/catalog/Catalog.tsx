import clsx from 'clsx'
import type { ReactNode } from 'react'
import { LuSearch } from 'react-icons/lu'

import { Input, RippleButton, SelectDropdown } from '@shared/ui'
import type { SelectDropdownOption } from '@shared/ui'

import styles from './Catalog.module.scss'

// The pieces both tabs are built from, after Seanime's marketplace: a heading
// with its actions, the filters, and a panel of cards per kind.

export interface CatalogHeaderProps {
	title: string
	subtitle: string
	source?: string
	actions?: ReactNode
}

export function CatalogHeader({ title, subtitle, source, actions }: CatalogHeaderProps) {
	return (
		<header className={styles.header}>
			<div className={styles.heading}>
				<h1 className={styles.title}>{title}</h1>
				<p className={styles.subtitle}>{subtitle}</p>
				{source && <p className={styles.source}>{source}</p>}
			</div>

			{actions && <div className={styles.actions}>{actions}</div>}
		</header>
	)
}

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
			<div className={styles.types} role='tablist'>
				{types.map(item => (
					<RippleButton
						key={item.value}
						role='tab'
						aria-selected={item.value === type}
						className={clsx(styles.type, item.value === type && styles.active)}
						onClick={() => onTypeChange(item.value)}
					>
						{item.label}
					</RippleButton>
				))}
			</div>

			<div className={styles.fields}>
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
		</div>
	)
}

export interface CatalogSectionProps {
	icon: ReactNode
	title: string
	description?: string
	children: ReactNode
}

export function CatalogSection({ icon, title, description, children }: CatalogSectionProps) {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHead}>
				<h2 className={styles.sectionTitle}>
					{icon}
					{title}
				</h2>
				{description && <p className={styles.sectionDescription}>{description}</p>}
			</div>

			<div className={styles.grid}>{children}</div>
		</section>
	)
}

export function CatalogEmpty({ children }: { children: ReactNode }) {
	return <div className={styles.empty}>{children}</div>
}
