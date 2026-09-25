import { createEvent, createStore, sample } from 'effector'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { libraryCandidatesQuery, type LibraryFile, setLibraryMatchMutation } from '@entities/library-item'

function failureMessage(error: unknown): string {
	if (error instanceof HttpRequestError && error.status === 428) {
		return translate('library.match.noSource')
	}

	if (error instanceof HttpRequestError && error.isOffline) {
		return translate('library.match.offline')
	}

	return translate('library.match.failed')
}

export const matchFileModel = atom(() => {
	const requested = createEvent<LibraryFile>()
	const closed = createEvent()
	const confirmed = createEvent<string>()

	const $file = createStore<LibraryFile | null>(null).on(requested, (_, file) => file)

	const $open = createStore(false)
		.on(requested, () => true)
		.reset(closed, setLibraryMatchMutation.finished.success)

	// The node has to ask the source, so the list is fetched when the drawer opens
	// rather than kept for every file in the library.
	sample({ clock: requested, fn: file => file.id, target: libraryCandidatesQuery.start })

	sample({
		clock: confirmed,
		source: $file,
		filter: (file): file is LibraryFile => file !== null,
		fn: (file: LibraryFile, mediaRef: string) => ({
			fileId: file.id,
			mediaRef,
			season: file.parsed.season ?? undefined,
			episode: file.parsed.episode ?? file.parsed.chapter ?? undefined
		}),
		target: setLibraryMatchMutation.start
	})

	setLibraryMatchMutation.finished.failure.watch(({ error }) => {
		toast.error(failureMessage(error), { id: 'library-match-failed' })
	})

	return {
		$open,
		$file,
		$applying: setLibraryMatchMutation.$pending,
		requested,
		closed,
		confirmed
	}
})
