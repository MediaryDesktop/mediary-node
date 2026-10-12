import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'

import { DropdownMenu } from './DropdownMenu'
import type { DropdownMenuItem } from './DropdownMenu'

export interface MoreMenuProps {
	items: DropdownMenuItem[]
	label: string
}

// The "⋮" menu at the end of a row.
export function MoreMenu({ items, label }: MoreMenuProps) {
	return (
		<DropdownMenu
			items={items}
			trigger={
				<Button
					size='small'
					variant='ghost'
					iconOnly
					aria-label={label}
					startIcon={<Icon name='common/more-vertical' size={16} />}
				/>
			}
		/>
	)
}
