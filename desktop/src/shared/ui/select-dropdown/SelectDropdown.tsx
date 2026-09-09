import clsx from 'clsx'
import type { KeyboardEvent, ReactNode } from 'react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'
import type { IconName } from '../icon/Icon'
import { useRipple } from '../ripple/useRipple'

import styles from './SelectDropdown.module.scss'

export interface SelectDropdownOption {
	value: string
	label: string
	description?: string
	icon?: IconName
	disabled?: boolean
}

interface SelectDropdownBaseProps {
	options: SelectDropdownOption[]
	placeholder?: string
	searchable?: boolean
	clearable?: boolean
	disabled?: boolean
	error?: string
	className?: string
	id?: string
	startIcon?: ReactNode
}

export type SelectDropdownProps = SelectDropdownBaseProps &
	(
		| { mode?: 'single'; value: string | null; onChange: (value: string | null) => void }
		| { mode: 'multiple'; value: string[]; onChange: (value: string[]) => void }
	)

const GAP = 4
const VIEWPORT_MARGIN = 8
const MAX_HEIGHT = 240
const MIN_HEIGHT = 96

interface Position {
	top: number
	left: number
	width: number
	maxHeight: number
}

const INITIAL_POSITION: Position = { top: 0, left: 0, width: 0, maxHeight: MAX_HEIGHT }

export function SelectDropdown(props: SelectDropdownProps) {
	const {
		options,
		placeholder,
		searchable = false,
		clearable = false,
		disabled = false,
		error,
		className,
		id,
		startIcon
	} = props

	const { t } = useTranslation()
	const generatedId = useId()
	const fieldId = id ?? generatedId
	const listId = `${fieldId}-list`
	const errorId = `${fieldId}-error`

	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [activeValue, setActiveValue] = useState<string | null>(null)
	const [position, setPosition] = useState<Position>(INITIAL_POSITION)

	const containerRef = useRef<HTMLDivElement>(null)
	const fieldRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)

	const multiple = props.mode === 'multiple'

	const selected = useMemo(
		() => (props.mode === 'multiple' ? props.value : props.value ? [props.value] : []),
		[props.mode, props.value]
	)

	const selectedOptions = useMemo(
		() => selected.flatMap(value => options.filter(option => option.value === value)),
		[options, selected]
	)

	const visible = useMemo(() => {
		const term = query.trim().toLowerCase()

		if (!term) {
			return options
		}

		return options.filter(
			option =>
				option.label.toLowerCase().includes(term) || option.description?.toLowerCase().includes(term)
		)
	}, [options, query])

	const commit = useCallback(
		(next: string[]) => {
			if (props.mode === 'multiple') {
				props.onChange(next)
				return
			}

			props.onChange(next[0] ?? null)
		},
		[props]
	)

	const activeIndex = useMemo(() => {
		const preferred = activeValue ?? selected[0]
		const preferredIndex = visible.findIndex(option => option.value === preferred && !option.disabled)

		return preferredIndex === -1
			? Math.max(
					0,
					visible.findIndex(option => !option.disabled)
				)
			: preferredIndex
	}, [activeValue, selected, visible])

	const close = useCallback(() => {
		setOpen(false)
		setQuery('')
		setActiveValue(null)
	}, [])

	const toggleOption = useCallback(
		(option: SelectDropdownOption) => {
			if (option.disabled) {
				return
			}

			if (multiple) {
				const next = selected.includes(option.value)
					? selected.filter(value => value !== option.value)
					: [...selected, option.value]

				commit(next)
				setQuery('')
				return
			}

			commit([option.value])
			close()
		},
		[close, commit, multiple, selected]
	)

	const clear = useCallback(() => commit([]), [commit])

	const updatePosition = useCallback(() => {
		const field = fieldRef.current

		if (!field) {
			return
		}

		const rect = field.getBoundingClientRect()
		const viewportHeight = window.innerHeight
		const below = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN
		const above = rect.top - GAP - VIEWPORT_MARGIN

		const openAbove = below < MAX_HEIGHT && above > below
		const available = openAbove ? above : below
		const maxHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, available))
		const height = Math.min(panelRef.current?.offsetHeight ?? maxHeight, maxHeight)

		const top = openAbove ? rect.top - GAP - height : rect.bottom + GAP

		setPosition({
			top: Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - height - VIEWPORT_MARGIN)),
			left: rect.left,
			width: rect.width,
			maxHeight
		})
	}, [])

	useLayoutEffect(() => {
		if (!open) {
			return
		}

		updatePosition()

		const frame = requestAnimationFrame(updatePosition)

		return () => cancelAnimationFrame(frame)
	}, [open, query, selected.length, updatePosition])

	useEffect(() => {
		const field = fieldRef.current

		if (!open || !field) {
			return
		}

		const observer = new ResizeObserver(updatePosition)
		observer.observe(field)

		window.addEventListener('scroll', updatePosition, true)
		window.addEventListener('resize', updatePosition)

		return () => {
			observer.disconnect()
			window.removeEventListener('scroll', updatePosition, true)
			window.removeEventListener('resize', updatePosition)
		}
	}, [open, updatePosition])

	useEffect(() => {
		if (!open) {
			return
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node

			if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
				return
			}

			close()
		}

		document.addEventListener('pointerdown', handlePointerDown)

		return () => document.removeEventListener('pointerdown', handlePointerDown)
	}, [close, open])

	useEffect(() => {
		if (!open) {
			return
		}

		panelRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
	}, [activeIndex, open])

	const step = (direction: 1 | -1) => {
		let next = activeIndex

		for (let attempt = 0; attempt < visible.length; attempt += 1) {
			next = (next + direction + visible.length) % visible.length
			const candidate = visible[next]

			if (candidate && !candidate.disabled) {
				setActiveValue(candidate.value)
				return
			}
		}
	}

	const jumpTo = (edge: 'first' | 'last') => {
		const enabled = visible.filter(option => !option.disabled)
		const target = edge === 'first' ? enabled[0] : enabled[enabled.length - 1]

		if (target) {
			setActiveValue(target.value)
		}
	}

	const selectActive = () => {
		const option = visible[activeIndex]

		if (option) {
			toggleOption(option)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowUp': {
				event.preventDefault()

				if (open) {
					step(event.key === 'ArrowDown' ? 1 : -1)
					return
				}

				setOpen(true)
				return
			}

			case 'Home':
			case 'End': {
				if (!open) {
					return
				}

				event.preventDefault()
				jumpTo(event.key === 'Home' ? 'first' : 'last')
				return
			}

			case 'Enter': {
				event.preventDefault()

				if (open) {
					selectActive()
					return
				}

				setOpen(true)
				return
			}

			case ' ': {
				if (searchable && open) {
					return
				}

				event.preventDefault()

				if (open) {
					selectActive()
					return
				}

				setOpen(true)
				return
			}

			case 'Escape': {
				if (open) {
					event.preventDefault()
					event.stopPropagation()
					close()
				}

				return
			}

			case 'Tab': {
				close()
				return
			}

			case 'Backspace': {
				if (multiple && query === '' && selected.length > 0) {
					commit(selected.slice(0, -1))
				}
			}
		}
	}

	const single = selectedOptions[0]
	const inputValue = open && searchable ? query : multiple ? '' : (single?.label ?? '')
	const showPlaceholder = selected.length === 0 || (open && searchable)

	return (
		<div className={clsx(styles.field, className)} ref={containerRef}>
			<div
				ref={fieldRef}
				className={clsx(
					styles.control,
					open && styles.isOpen,
					disabled && styles.isDisabled,
					error && styles.invalid
				)}
				onMouseDown={event => {
					if (disabled || event.button !== 0) {
						return
					}

					event.preventDefault()
					inputRef.current?.focus()
					setOpen(current => !current)
				}}
			>
				{startIcon && <span className={styles.startIcon}>{startIcon}</span>}

				{!startIcon && !multiple && single?.icon && (
					<Icon name={single.icon} size={18} className={styles.startIcon} />
				)}

				{multiple && selectedOptions.length > 0 && (
					<div className={styles.tags}>
						{selectedOptions.map(option => (
							<span key={option.value} className={styles.tag}>
								{option.icon && <Icon name={option.icon} size={14} />}
								<span className={styles.tagLabel}>{option.label}</span>

								<button
									type='button'
									className={styles.tagRemove}
									aria-label={t('select.remove', { label: option.label })}
									onMouseDown={event => event.stopPropagation()}
									onClick={() => toggleOption(option)}
								>
									<Icon name='common/close' size={12} />
								</button>
							</span>
						))}
					</div>
				)}

				<input
					ref={inputRef}
					id={fieldId}
					className={styles.input}
					role='combobox'
					readOnly={!searchable}
					disabled={disabled}
					value={inputValue}
					placeholder={showPlaceholder ? (placeholder ?? t('select.placeholder')) : undefined}
					autoComplete='off'
					spellCheck={false}
					aria-expanded={open}
					aria-controls={listId}
					aria-autocomplete={searchable ? 'list' : 'none'}
					aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					onChange={event => {
						setQuery(event.target.value)
						setOpen(true)
					}}
					onKeyDown={handleKeyDown}
					onMouseDown={event => event.stopPropagation()}
					onClick={() => !disabled && setOpen(current => !current)}
				/>

				<div className={styles.actions}>
					{clearable && selected.length > 0 && !disabled && (
						<button
							type='button'
							className={styles.action}
							aria-label={t('select.clear')}
							onMouseDown={event => event.stopPropagation()}
							onClick={clear}
						>
							<Icon name='common/close' size={16} />
						</button>
					)}

					<Icon
						name='common/chevron-down'
						size={16}
						className={clsx(styles.chevron, open && styles.chevronUp)}
					/>
				</div>
			</div>

			{error && (
				<p id={errorId} className={styles.error}>
					{error}
				</p>
			)}

			{open &&
				createPortal(
					<div
						ref={panelRef}
						className={styles.panel}
						style={{ top: position.top, left: position.left, width: position.width }}
					>
						<div
							id={listId}
							role='listbox'
							aria-multiselectable={multiple || undefined}
							className={styles.list}
							style={{ maxHeight: position.maxHeight }}
						>
							{visible.map((option, index) => (
								<Option
									key={option.value}
									id={`${listId}-${index}`}
									option={option}
									selected={selected.includes(option.value)}
									active={index === activeIndex}
									multiple={multiple}
									onSelect={toggleOption}
									onHover={() => setActiveValue(option.value)}
								/>
							))}

							{visible.length === 0 && <p className={styles.empty}>{t('select.noResults')}</p>}
						</div>
					</div>,
					document.body
				)}
		</div>
	)
}

interface OptionProps {
	id: string
	option: SelectDropdownOption
	selected: boolean
	active: boolean
	multiple: boolean
	onSelect: (option: SelectDropdownOption) => void
	onHover: () => void
}

function Option({ id, option, selected, active, multiple, onSelect, onHover }: OptionProps) {
	const ripple = useRipple<HTMLDivElement>({ disabled: option.disabled })

	return (
		<div
			ref={ripple}
			id={id}
			role='option'
			aria-selected={selected}
			aria-disabled={option.disabled || undefined}
			data-active={active}
			className={clsx(
				styles.option,
				selected && styles.isSelected,
				active && styles.isActive,
				option.disabled && styles.isDisabled
			)}
			onMouseMove={onHover}
			onMouseDown={event => event.preventDefault()}
			onClick={() => onSelect(option)}
		>
			{multiple && <span className={clsx(styles.checkbox, selected && styles.isChecked)} />}

			{option.icon && <Icon name={option.icon} size={20} className={styles.optionIcon} />}

			<span className={styles.optionText}>
				<span className={styles.optionLabel}>{option.label}</span>
				{option.description && <span className={styles.optionDescription}>{option.description}</span>}
			</span>

			{!multiple && selected && <Icon name='common/check' size={16} className={styles.check} />}
		</div>
	)
}
