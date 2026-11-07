import { ownRequest } from '@shared/factory'

import { checkTorrentClientMutation, putTorrentSettingsMutation } from '@entities/torrent'

// Asks for a library folder on the form's behalf, so it picks only the folder it
// asked for — not one added from the library settings meanwhile.
export const FOLDER_REQUESTER = 'torrent-client'

export const clientSave = ownRequest(putTorrentSettingsMutation)

// A check answered after the form changed, or after a newer check, is not about
// what the form now shows.
export const clientCheck = ownRequest(checkTorrentClientMutation)
