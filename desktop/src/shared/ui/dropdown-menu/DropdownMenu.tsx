import * as Primitive from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Icon } from '../icon/Icon'
import type { IconName } from '../icon/Icon'

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
	label?: string
}

export function DropdownMenu({ trigger, items, align = 'end', label }: DropdownMenuProps) {
	return (
		<Primitive.Root>
			<Primitive.Trigger asChild>{trigger}</Primitive.Trigger>

			<Primitive.Portal>
				<Primitive.Content
					align={align}
					sideOffset={6}
					collisionPadding={12}
					className={styles.content}
				>
					{label && <Primitive.Label className={styles.label}>{label}</Primitive.Label>}

					{items.map(item => (
						<Primitive.Item
							key={item.id}
							disabled={item.disabled}
							onSelect={item.onSelect}
							className={clsx(styles.item, item.danger && styles.danger)}
						>
							{item.icon && <Icon name={item.icon} size={16} className={styles.icon} />}
							<span className={styles.text}>{item.label}</span>
							{item.checked && <Icon name='common/check' size={16} className={styles.check} />}
						</Primitive.Item>
					))}
				</Primitive.Content>
			</Primitive.Portal>
		</Primitive.Root>
	)
}
