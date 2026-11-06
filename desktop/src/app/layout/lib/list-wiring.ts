import { sample } from 'effector'

import { createTrackerListMutation } from '@entities/tracker'

import { manageListsModel } from '@features/manage-lists'
import { manageEntryModel } from '@features/track-media'

sample({
	clock: manageEntryModel.createListRequested,
	source: manageEntryModel.$target,
	filter: target => target !== null,
	fn: target => target!.mediaType,
	target: manageListsModel.createRequested
})

sample({
	clock: createTrackerListMutation.finished.success,
	source: { open: manageEntryModel.$open, target: manageEntryModel.$target },
	filter: ({ open, target }, { result }) => open && target?.mediaType === result.media_type,
	fn: (_, { result }) => result.name,
	target: manageEntryModel.listCreated
})
