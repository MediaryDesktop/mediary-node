import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import type { ListMediaType } from '../../api/api'

export const MEDIA_TYPE_ICONS: Record<ListMediaType, IconName> = {
	movie: 'categories/movie',
	series: 'categories/series',
	dorama: 'categories/series',
	anime: 'categories/anime',
	book: 'categories/book',
	manga: 'categories/manga'
}

export interface MediaTypeIconProps {
	type: ListMediaType
	size?: number
	className?: string
}

export function MediaTypeIcon({ type, size = 18, className }: MediaTypeIconProps) {
	return <Icon name={MEDIA_TYPE_ICONS[type]} size={size} className={className} />
}
