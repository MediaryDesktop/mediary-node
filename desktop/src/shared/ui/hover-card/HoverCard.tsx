import * as Primitive from '@radix-ui/react-hover-card'
import clsx from 'clsx'
import type { ReactNode, Ref } from 'react'

import styles from './HoverCard.module.scss'

export interface HoverCardProps {
	trigger: ReactNode
	children: ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
	align?: 'start' | 'center' | 'end'
	sideOffset?: number
	alignOffset?: number
	openDelay?: number
	closeDelay?: number
	open?: boolean
	onOpenChange?: (open: boolean) => void
	contentRef?: Ref<HTMLDivElement>
	motion?: 'slide' | 'grow'
	className?: string
}

export function HoverCard({
	trigger,
	children,
	side = 'right',
	align = 'start',
	sideOffset = 10,
	alignOffset = 0,
	openDelay = 450,
	closeDelay = 120,
	open,
	onOpenChange,
	contentRef,
	motion = 'slide',
	className
}: HoverCardProps) {
	return (
		<Primitive.Root openDelay={openDelay} closeDelay={closeDelay} open={open} onOpenChange={onOpenChange}>
			<Primitive.Trigger asChild>{trigger}</Primitive.Trigger>

			<Primitive.Portal>
				<Primitive.Content
					ref={contentRef}
					side={side}
					align={align}
					sideOffset={sideOffset}
					alignOffset={alignOffset}
					collisionPadding={16}
					className={clsx(styles.content, motion === 'grow' && styles.grow, className)}
				>
					{children}
				</Primitive.Content>
			</Primitive.Portal>
		</Primitive.Root>
	)
}
