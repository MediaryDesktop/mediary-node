import { ownRequest } from '@shared/factory'

import { checkTorrentRuleMutation } from '@entities/torrent'

// "Check now" in the list of rules and the check on a title's own rule panel go
// through one mutation; each shows only the answer to the check it ran.
export const listCheck = ownRequest(checkTorrentRuleMutation)
export const panelCheck = ownRequest(checkTorrentRuleMutation)
