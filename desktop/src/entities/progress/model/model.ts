import { concurrency, createMutation, createQuery, keepFresh } from '@farfetched/core'

import { nodeStreamResumed, nodeTopic } from '@infra/node'

import { fetchTitleProgressFx, setChapterReadFx, setEpisodeWatchedFx } from '../api/api'

// Where the user is in the episodes and chapters of the title on screen.
export const titleProgressQuery = createQuery({ effect: fetchTitleProgressFx, name: 'titleProgress' })

concurrency(titleProgressQuery, { strategy: 'TAKE_LATEST' })

export const setEpisodeWatchedMutation = createMutation({
	effect: setEpisodeWatchedFx,
	name: 'setEpisodeWatched'
})

export const setChapterReadMutation = createMutation({ effect: setChapterReadFx, name: 'setChapterRead' })

// The node announces an episode watched through and a chapter read; a position
// alone it does not, so the end of playback is what brings a new one in.
keepFresh(titleProgressQuery, {
	triggers: [
		nodeTopic('progress'),
		nodeTopic('playback').filter({ fn: event => event.payload?.state === 'ended' }),
		nodeStreamResumed,
		setEpisodeWatchedMutation.finished.success,
		setChapterReadMutation.finished.success
	]
})
