import * as Primitive from '@radix-ui/react-tabs'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './Tabs.module.scss'

export interface TabItem<Value extends string> {
	value: Value
	label: ReactNode
	content?: ReactNode
	disabled?: boolean
}

export interface TabsProps<Value extends string> {
	value: Value
	onValueChange: (value: Value) => void
	items: readonly TabItem<Value>[]
	label?: string
	className?: string
}

export function Tabs<Value extends string>({
	value,
	onValueChange,
	items,
	label,
	className
}: TabsProps<Value>) {
	const hasContent = items.some(item => item.content !== undefined)

	return (
		<Primitive.Root
			value={value}
			onValueChange={next => onValueChange(next as Value)}
			className={clsx(styles.root, className)}
		>
			<Primitive.List className={styles.list} aria-label={label}>
				{items.map(item => (
					<Primitive.Trigger
						key={item.value}
						value={item.value}
						disabled={item.disabled}
						className={styles.trigger}
					>
						{item.label}
					</Primitive.Trigger>
				))}
			</Primitive.List>

			{hasContent &&
				items.map(item => (
					<Primitive.Content key={item.value} value={item.value} className={styles.content}>
						{item.content}
					</Primitive.Content>
				))}
		</Primitive.Root>
	)
}
