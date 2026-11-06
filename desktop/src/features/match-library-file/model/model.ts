import { createEvent, createStore, sample } from 'effector'
import { or } from 'patronum'

import { HttpRequestError } from '@shared/api'
import { atom } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import {
	libraryCandidatesQuery,
	type LibraryFile,
	setLibraryMatchesMutation,
	setLibraryMatchMutation
} from '@entities/library-item'

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
	const requestedMany = createEvent<LibraryFile[]>()
	const closed = createEvent()
	const confirmed = createEvent<string>()

	const $files = createStore<LibraryFile[]>([])
		.on(requested, (_, file) => [file])
		.on(requestedMany, (_, files) => files)

	const $file = $files.map(files => files[0] ?? null)

	const $open = createStore(false)
		.on([requested, requestedMany], () => true)
		.reset(closed, setLibraryMatchMutation.finished.success, setLibraryMatchesMutation.finished.success)

	sample({
		clock: [requested, requestedMany],
		source: $file,
		filter: (file): file is LibraryFile => file !== null,
		fn: (file: LibraryFile) => file.id,
		target: libraryCandidatesQuery.start
	})

	const matchOf = (file: LibraryFile, mediaRef: string) => ({
		fileId: file.id,
		mediaRef,
		season: file.parsed.season ?? undefined,
		episode: file.parsed.episode ?? file.parsed.chapter ?? undefined
	})

	sample({
		clock: confirmed,
		source: $files,
		filter: files => files.length === 1,
		fn: (files: LibraryFile[], mediaRef: string) => matchOf(files[0] as LibraryFile, mediaRef),
		target: setLibraryMatchMutation.start
	})

	sample({
		clock: confirmed,
		source: $files,
		filter: files => files.length > 1,
		fn: (files: LibraryFile[], mediaRef: string) => files.map(file => matchOf(file, mediaRef)),
		target: setLibraryMatchesMutation.start
	})

	setLibraryMatchMutation.finished.failure.watch(({ error }) => {
		toast.error(failureMessage(error), { id: 'library-match-failed' })
	})

	setLibraryMatchesMutation.finished.success.watch(({ result }) => {
		if (result.failed > 0) {
			toast.error(translate('library.match.someFailed', { count: result.failed }), {
				id: 'library-match-failed'
			})
		}
	})

	return {
		$open,
		$file,
		$files,
		$applying: or(setLibraryMatchMutation.$pending, setLibraryMatchesMutation.$pending),
		requested,
		requestedMany,
		closed,
		confirmed
	}
})
