import { createElement } from 'react'
import type { IconType } from 'react-icons'
import * as lucide from 'react-icons/lu'
import { LuList } from 'react-icons/lu'

import type { ListMediaType } from '../../api/api'
import { MediaTypeIcon } from '../media-type-icon/MediaTypeIcon'

export function lucideName(component: string): string {
	return component
		.slice(2)
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Za-z])(\d)/g, '$1-$2')
		.toLowerCase()
}

const ICONS: Record<string, IconType> = Object.fromEntries(
	Object.entries(lucide)
		.filter(([component]) => component.startsWith('Lu'))
		.map(([component, glyph]) => [lucideName(component), glyph as IconType])
)

export const LIST_ICONS: readonly string[] = Object.keys(ICONS).sort()

export function isListIcon(name: string | null | undefined): name is string {
	return !!name && Object.hasOwn(ICONS, name)
}

export interface ListIconProps {
	icon?: string | null
	mediaType?: ListMediaType
	size?: number
	className?: string
}

export function ListIcon({ icon, mediaType, size = 20, className }: ListIconProps) {
	if (!isListIcon(icon) && mediaType) {
		return <MediaTypeIcon type={mediaType} size={size} className={className} />
	}

	const glyph = (isListIcon(icon) && ICONS[icon]) || LuList

	return createElement(glyph, { size, className, 'aria-hidden': true, focusable: false })
}
