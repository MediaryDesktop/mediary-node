import * as Primitive from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { Icon } from '../icon/Icon'
import type { IconName } from '../icon/Icon'
import { useRipple } from '../ripple/useRipple'

import styles from './DropdownMenu.module.scss'

export interface DropdownMenuItem {
	id: string
	label: string
	icon?: IconName
	danger?: boolean
	disabled?: boolean
	checked?: boolean
	onSelect: () => void
}

export interface DropdownMenuProps {
	trigger: ReactNode
	items: DropdownMenuItem[]
	align?: 'start' | 'center' | 'end'
}

interface MenuItemProps {
	item: DropdownMenuItem
	index: number
}

function MenuItem({ item, index }: MenuItemProps) {
	const ripple = useRipple<HTMLDivElement>({ disabled: item.disabled })

	return (
		<Primitive.Item
			ref={ripple}
			disabled={item.disabled}
			onSelect={item.onSelect}
			className={clsx(styles.item, item.danger && styles.danger)}
			style={{ '--index': index } as CSSProperties}
		>
			{item.icon && <Icon name={item.icon} size={20} className={styles.icon} />}
			<span className={styles.text}>{item.label}</span>
			{item.checked && <Icon name='common/check' size={18} className={styles.check} />}
		</Primitive.Item>
	)
}

export function DropdownMenu({ trigger, items, align = 'end' }: DropdownMenuProps) {
	const [open, setOpen] = useState(false)

	useEffect(() => {
		if (!open) {
			return
		}

		const close = () => setOpen(false)

		window.addEventListener('wheel', close, { passive: true })
		window.addEventListener('touchmove', close, { passive: true })

		return () => {
			window.removeEventListener('wheel', close)
			window.removeEventListener('touchmove', close)
		}
	}, [open])

	return (
		<Primitive.Root modal={false} open={open} onOpenChange={setOpen}>
			<Primitive.Trigger asChild>{trigger}</Primitive.Trigger>

			<Primitive.Portal>
				<Primitive.Content
					align={align}
					sideOffset={6}
					collisionPadding={12}
					className={styles.content}
				>
					{items.map((item, index) => (
						<MenuItem key={item.id} item={item} index={index} />
					))}
				</Primitive.Content>
			</Primitive.Portal>
		</Primitive.Root>
	)
}
