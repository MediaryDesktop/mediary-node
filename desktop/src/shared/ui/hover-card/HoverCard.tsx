import * as Primitive from '@radix-ui/react-hover-card'
import clsx from 'clsx'
import type { ReactNode } from 'react'

import styles from './HoverCard.module.scss'

export interface HoverCardProps {
	trigger: ReactNode
	children: ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
	align?: 'start' | 'center' | 'end'
	openDelay?: number
	className?: string
}

export function HoverCard({
	trigger,
	children,
	side = 'right',
	align = 'start',
	openDelay = 450,
	className
}: HoverCardProps) {
	return (
		<Primitive.Root openDelay={openDelay} closeDelay={120}>
			<Primitive.Trigger asChild>{trigger}</Primitive.Trigger>

			<Primitive.Portal>
				<Primitive.Content
					side={side}
					align={align}
					sideOffset={10}
					collisionPadding={16}
					className={clsx(styles.content, className)}
				>
					{children}
				</Primitive.Content>
			</Primitive.Portal>
		</Primitive.Root>
	)
}
