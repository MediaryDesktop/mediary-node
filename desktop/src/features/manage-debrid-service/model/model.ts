import { ownRequest } from '@shared/factory'

import { checkTorrentDebridMutation, putTorrentDebridMutation } from '@entities/torrent'

export const debridSave = ownRequest(putTorrentDebridMutation)

// A check answered after another service was picked, or after a newer check,
// is not about what the form now shows.
export const debridCheck = ownRequest(checkTorrentDebridMutation)
