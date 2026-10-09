import { createRoute } from '@tanstack/react-router'

import { ReadBookPage } from '@pages/read'

import { rootRoute } from './root'

// Outside the framed layout, like a chapter: a book owns the whole window.
export const readBookRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/read-book/$fileId',
	component: function ReadBookRoute() {
		const { fileId } = readBookRoute.useParams()
		const id = Number(fileId)

		return <ReadBookPage key={id} fileId={id} />
	}
})
