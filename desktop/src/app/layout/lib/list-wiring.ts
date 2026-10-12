import { sample } from 'effector'

import { createTrackerListMutation } from '@entities/tracker'

import { manageListsModel } from '@features/manage-lists'
import { manageEntryModel } from '@features/track-media'

// Two features that do not know each other: putting a title on a list can ask
// for a new list, and the list made there comes back ticked. Joining them is the
// app's job.
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
