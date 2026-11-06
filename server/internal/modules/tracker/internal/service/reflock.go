package service

import "sync"

// refLocks serialises the writes to one local entry. A write reads the entry,
// applies a patch and saves the whole row, so two at once — the user changing
// the score while the player raises the progress — would lose one of them. A
// lock per title rather than one for the tracker: describing a title being
// added may wait on the network, and the other titles need not wait with it.
type refLocks struct {
	mu    sync.Mutex
	locks map[string]*refLock
}

type refLock struct {
	sync.Mutex
	holders int
}

// lock takes the title's lock and returns what releases it. The entry for a
// title is dropped once nobody holds or waits for it, so the map stays as small
// as the number of titles being written at this moment.
func (l *refLocks) lock(mediaRef string) (unlock func()) {
	l.mu.Lock()
	if l.locks == nil {
		l.locks = map[string]*refLock{}
	}
	entry, ok := l.locks[mediaRef]
	if !ok {
		entry = &refLock{}
		l.locks[mediaRef] = entry
	}
	entry.holders++
	l.mu.Unlock()

	entry.Lock()

	return func() {
		entry.Unlock()

		l.mu.Lock()
		entry.holders--
		if entry.holders == 0 {
			delete(l.locks, mediaRef)
		}
		l.mu.Unlock()
	}
}
