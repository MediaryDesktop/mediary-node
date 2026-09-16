import * as Primitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

import styles from './Tooltip.module.scss'

export interface TooltipProps {
	content: ReactNode
	children: ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
	delay?: number
}

export function Tooltip({ content, children, side = 'top', delay = 300 }: TooltipProps) {
	return (
		<Primitive.Provider delayDuration={delay} skipDelayDuration={200}>
			<Primitive.Root>
				<Primitive.Trigger asChild>{children}</Primitive.Trigger>

				<Primitive.Portal>
					<Primitive.Content
						side={side}
						sideOffset={6}
						collisionPadding={12}
						className={styles.content}
					>
						{content}
					</Primitive.Content>
				</Primitive.Portal>
			</Primitive.Root>
		</Primitive.Provider>
	)
}
