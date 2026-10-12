import { BookFiles } from './book-files/BookFiles'
import { ChapterList } from './chapter-list/ChapterList'
import { EpisodeLibrary } from './episode-library/EpisodeLibrary'

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
				coverColor={props.coverColor}
			/>
		)
	}

	if (mediaType === 'book') {
		return <BookFiles mediaRef={props.mediaRef} />
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
