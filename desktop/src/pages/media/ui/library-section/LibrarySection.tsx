import { FreeCopies } from '@features/download-free-book'

import { BookFiles } from './book-files/BookFiles'
import { ChapterList } from './chapter-list/ChapterList'
import { EpisodeLibrary } from './episode-library/EpisodeLibrary'
import styles from './LibrarySection.module.scss'

const VIDEO_TYPES = ['anime', 'movie', 'series', 'dorama']

export interface LibrarySectionProps {
	mediaRef: string
	title: string
	cover: string | null
	coverColor: string | null
	banner: string | null
	total: number | null | undefined
	mediaType: string
	progress: number
	listed: boolean
}

// What the library holds for the title, in the form its kind reads in: chapters for
// manga, files for a book, episodes for anything watched.
export function LibrarySection({ mediaType, ...props }: LibrarySectionProps) {
	if (mediaType === 'manga') {
		return (
			<ChapterList
				mediaRef={props.mediaRef}
				title={props.title}
				progress={props.progress}
				listed={props.listed}
			/>
		)
	}

	// The copies the library has, then the free ones a source could add to it.
	if (mediaType === 'book') {
		return (
			<div className={styles.book}>
				<BookFiles mediaRef={props.mediaRef} />
				<FreeCopies mediaRef={props.mediaRef} />
			</div>
		)
	}

	if (!VIDEO_TYPES.includes(mediaType)) {
		return null
	}

	return (
		<EpisodeLibrary
			mediaRef={props.mediaRef}
			cover={props.cover}
			coverColor={props.coverColor}
			banner={props.banner}
			total={props.total}
			progress={props.progress}
		/>
	)
}
