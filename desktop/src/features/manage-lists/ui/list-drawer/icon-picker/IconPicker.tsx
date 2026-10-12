import clsx from 'clsx'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon } from '@shared/ui'

import { LIST_ICONS, ListIcon } from '@entities/tracker'
import type { ListMediaType } from '@entities/tracker'

import { filterIcons, iconLabel } from '../../../lib/icon-search'

import styles from './IconPicker.module.scss'

export interface IconPickerProps {
	value: string
	// The list's media type, which the default icon is taken from.
	mediaType: ListMediaType
	onChange: (icon: string) => void
	disabled?: boolean
}

// A dropdown that opens in place, under its field, rather than floating over the
// page: inside a drawer, a panel portalled out of it would sit outside the
// drawer's focus trap, and its search box could never be typed into.
export function IconPicker({ value, mediaType, onChange, disabled }: IconPickerProps) {
	const { t } = useTranslation()
	const panelId = useId()

	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')

	const containerRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const searchRef = useRef<HTMLInputElement>(null)
	const gridRef = useRef<HTMLDivElement>(null)

	const matches = useMemo(() => filterIcons(LIST_ICONS, query), [query])

	// The default sits first while nothing is searched for: choosing nothing and
	// choosing the default are the same thing, and the grid says so.
	const options = query.trim() === '' ? ['', ...matches] : matches

	const close = useCallback(() => {
		setOpen(false)
		setQuery('')
	}, [])

	const choose = (icon: string) => {
		onChange(icon)
		close()
		triggerRef.current?.focus()
	}

	useEffect(() => {
		if (!open) {
			return
		}

		searchRef.current?.focus()

		const onPointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				close()
			}
		}

		document.addEventListener('pointerdown', onPointerDown)

		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [open, close])

	const cells = () => Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])

	const focusCell = (index: number) => {
		const all = cells()
		all[Math.min(Math.max(index, 0), all.length - 1)]?.focus()
	}

	const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === 'Escape') {
			event.preventDefault()
			close()
			triggerRef.current?.focus()
			return
		}

		if (event.target === searchRef.current) {
			if (event.key === 'ArrowDown') {
				event.preventDefault()
				const all = cells()
				const current = all.findIndex(cell => cell.dataset.icon === value)
				focusCell(current >= 0 ? current : 0)
			} else if (event.key === 'Enter') {
				event.preventDefault()
				const first = options[0]
				if (first !== undefined) {
					choose(first)
				}
			}
			return
		}

		const all = cells()
		const at = all.findIndex(cell => cell === document.activeElement)
		if (at < 0) {
			return
		}

		// The number of columns is whatever the panel fits, so it is read off the
		// rendered cells rather than assumed.
		const top = all[0]?.offsetTop ?? 0
		const columns = Math.max(all.filter(cell => cell.offsetTop === top).length, 1)

		const step: Record<string, number> = {
			ArrowRight: 1,
			ArrowLeft: -1,
			ArrowDown: columns,
			ArrowUp: -columns
		}

		const delta = step[event.key]
		if (delta === undefined) {
			return
		}

		event.preventDefault()

		if (event.key === 'ArrowUp' && at < columns) {
			searchRef.current?.focus()
			return
		}

		focusCell(at + delta)
	}

	const selectedLabel = value === '' ? t('lists.manage.iconDefault') : iconLabel(value)

	return (
		<div ref={containerRef} className={styles.root} data-handles-escape={open ? '' : undefined}>
			<button
				ref={triggerRef}
				type='button'
				className={clsx(styles.control, open && styles.isOpen)}
				disabled={disabled}
				aria-haspopup='dialog'
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				onClick={() => (open ? close() : setOpen(true))}
			>
				<span className={styles.leading}>
					<ListIcon icon={value} mediaType={mediaType} size={18} />
				</span>
				<span className={styles.label}>{selectedLabel}</span>
				<Icon
					name='common/chevron-down'
					size={16}
					className={clsx(styles.chevron, open && styles.chevronUp)}
				/>
			</button>

			{open && (
				<div
					id={panelId}
					className={styles.panel}
					role='dialog'
					aria-label={t('lists.manage.iconLabel')}
					onKeyDown={onPanelKeyDown}
				>
					<div className={styles.search}>
						<Icon name='common/search' size={16} className={styles.searchIcon} />
						<input
							ref={searchRef}
							className={styles.searchInput}
							value={query}
							placeholder={t('lists.manage.iconSearch')}
							autoComplete='off'
							spellCheck={false}
							onChange={event => setQuery(event.target.value)}
						/>
						<span className={styles.count}>
							{t('lists.manage.iconCount', { count: matches.length })}
						</span>
					</div>

					{options.length === 0 ? (
						<p className={styles.empty}>{t('lists.manage.iconNoMatches')}</p>
					) : (
						<div
							ref={gridRef}
							className={styles.grid}
							role='listbox'
							aria-label={t('lists.manage.iconLabel')}
						>
							{options.map(icon => {
								const selected = icon === value
								const label = icon === '' ? t('lists.manage.iconDefault') : iconLabel(icon)

								return (
									<button
										key={icon || 'default'}
										type='button'
										role='option'
										aria-selected={selected}
										aria-label={label}
										title={label}
										data-icon={icon}
										className={clsx(
											styles.cell,
											selected && styles.selected,
											icon === '' && styles.default
										)}
										onClick={() => choose(icon)}
									>
										<ListIcon icon={icon} mediaType={mediaType} size={20} />
									</button>
								)
							})}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
