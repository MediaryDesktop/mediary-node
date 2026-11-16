import { sample } from 'effector'

import { manageListsModel } from '@features/manage-lists'
import { manageEntryModel } from '@features/track-media'

// The list drawer opens over the entry drawer it was asked from, so AppLayout
// renders <ListDrawer /> after <ManageEntryDrawer />: of two open drawers, the
// later one is on top.
sample({
	clock: manageEntryModel.createListRequested,
	source: manageEntryModel.$target,
	filter: target => target !== null,
	fn: target => target!.mediaType,
	target: manageListsModel.createRequested
})

sample({
	clock: manageListsModel.created,
	source: { open: manageEntryModel.$open, target: manageEntryModel.$target },
	filter: ({ open, target }, list) => open && target?.mediaType === list.media_type,
	fn: (_, list) => list.name,
	target: manageEntryModel.listCreated
})
