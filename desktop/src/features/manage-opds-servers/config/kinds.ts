import {
	bookOPDSServersQuery,
	checkBookOPDSServerMutation,
	createBookOPDSServerMutation,
	deleteBookOPDSServerMutation,
	updateBookOPDSServerMutation
} from '@entities/book-source'
import {
	checkOPDSServerMutation,
	createOPDSServerMutation,
	deleteOPDSServerMutation,
	opdsServersQuery,
	updateOPDSServerMutation
} from '@entities/manga-source'

// Manga and books each keep their own OPDS servers on the node, under their own
// endpoints, but the servers are the same thing and so is the screen that
// manages them. What differs is which endpoints, and the words.
export const OPDS_KINDS = {
	manga: {
		servers: opdsServersQuery,
		create: createOPDSServerMutation,
		update: updateOPDSServerMutation,
		remove: deleteOPDSServerMutation,
		check: checkOPDSServerMutation,
		section: 'settings.mangaSources',
		text: 'mangaSources',
		toast: 'opds',
		urlPlaceholder: 'http://nas:25600/opds/v1.2/catalog',
		patronsFeed: null
	},
	books: {
		servers: bookOPDSServersQuery,
		create: createBookOPDSServerMutation,
		update: updateBookOPDSServerMutation,
		remove: deleteBookOPDSServerMutation,
		check: checkBookOPDSServerMutation,
		section: 'settings.bookServers',
		text: 'bookSources.servers',
		toast: 'book-opds',
		urlPlaceholder: 'http://nas:8083/opds',
		// Standard Ebooks' feed takes the e-mail of a Patrons Circle membership as
		// its user name; the hint says so when that is the address typed.
		patronsFeed: 'https://standardebooks.org/feeds/opds'
	}
} as const

export type OPDSKind = keyof typeof OPDS_KINDS
