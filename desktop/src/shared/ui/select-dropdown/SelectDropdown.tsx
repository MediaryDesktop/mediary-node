import clsx from 'clsx'
import type { KeyboardEvent, ReactNode } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'
import type { IconName } from '../icon/Icon'
import { useRipple } from '../ripple/useRipple'

import { activeIndexOf, edgeIndex, filterOptions, resolveKeyAction, stepIndex } from './lib'
import styles from './SelectDropdown.module.scss'
import { useFloatingPanel } from './useFloatingPanel'

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

	const visible = useMemo(() => filterOptions(options, query), [options, query])

	const activeIndex = useMemo(
		() => activeIndexOf(visible, activeValue ?? selected[0]),
		[visible, activeValue, selected]
	)

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

	const close = useCallback(() => {
		setOpen(false)
		setQuery('')
		setActiveValue(null)
	}, [])

	const position = useFloatingPanel({ open, anchorRef: fieldRef, panelRef, containerRef, onDismiss: close })

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

	useEffect(() => {
		if (!open) {
			return
		}

		panelRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
	}, [activeIndex, open])

	const moveTo = (index: number | null) => {
		const option = index === null ? undefined : visible[index]

		if (option) {
			setActiveValue(option.value)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		const action = resolveKeyAction(event.key, {
			open,
			searchable,
			multiple,
			hasQuery: query !== '',
			hasSelection: selected.length > 0
		})

		if (action === null) {
			return
		}

		if (action !== 'close') {
			event.preventDefault()
		}

		switch (action) {
			case 'open':
				setOpen(true)
				return

			case 'close':
			case 'dismiss':
				if (action === 'dismiss') {
					event.stopPropagation()
				}

				close()
				return

			case 'next':
				moveTo(stepIndex(visible, activeIndex, 1))
				return

			case 'previous':
				moveTo(stepIndex(visible, activeIndex, -1))
				return

			case 'first':
				moveTo(edgeIndex(visible, 'first'))
				return

			case 'last':
				moveTo(edgeIndex(visible, 'last'))
				return

			case 'select': {
				const option = visible[activeIndex]

				if (option) {
					toggleOption(option)
				}

				return
			}

			case 'removeLast':
				commit(selected.slice(0, -1))
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
