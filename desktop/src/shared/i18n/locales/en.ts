type Widen<T> = { [Key in keyof T]: T[Key] extends string ? string : Widen<T[Key]> }

export type Translation = Widen<typeof en>

export const en = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
	},

	theme: {
		label: 'Theme',
		dark: 'Dark theme',
		light: 'Light theme'
	},

	node: {
		state: {
			stopped: 'Node stopped',
			starting: 'Node starting…',
			ready: 'Node connected',
			restarting: 'Node restarting…',
			failed: 'Node failed to start'
		}
	},

	input: {
		showPassword: 'Show password',
		hidePassword: 'Hide password'
	},

	datePicker: {
		previousMonth: 'Previous month',
		nextMonth: 'Next month',
		previousYear: 'Previous year',
		nextYear: 'Next year'
	},

	nav: {
		label: 'Main navigation',
		home: 'Home',
		discover: 'Discover',
		search: 'Search',
		lists: 'My lists',
		library: 'Local library',
		downloads: 'Downloads',
		settings: 'Settings',
		signIn: 'Sign in'
	},

	anilist: {
		connect: {
			title: 'AniList',
			description:
				'Anime and manga live in your AniList account. Mediary reads and updates them from this computer',
			open: 'Get a token on AniList',
			tokenLabel: 'Access token',
			tokenPlaceholder: 'Paste the token from AniList',
			tokenHint:
				'AniList opens in your browser. Approve access, copy the token it shows and paste it here',
			submit: 'Connect',
			notConfigured: 'This build has no AniList client configured, so sign-in is unavailable',
			connectedAs: 'Connected as {{name}}',
			disconnect: 'Disconnect',
			failure: {
				rejected: 'AniList did not accept this token. Copy it again and retry',
				unreachable: 'AniList is unreachable right now. Check your connection and retry',
				unknown: 'Could not connect the account. Try again'
			}
		}
	},

	common: {
		cancel: 'Cancel',
		breadcrumbs: 'Breadcrumb'
	},

	lists: {
		listCount_one: '{{count}} list',
		listCount_few: '{{count}} lists',
		listCount_many: '{{count}} lists',
		listCount_other: '{{count}} lists',
		titleCount_one: '{{count}} title',
		titleCount_few: '{{count}} titles',
		titleCount_many: '{{count}} titles',
		titleCount_other: '{{count}} titles',
		pinned: 'Pinned',
		yours: 'Your lists',
		search: 'Search lists',
		filterAll: 'All',
		seeAll: 'See all',
		noMatches: 'No list matches that search',
		noLists: 'No lists yet',
		filters: {
			search: 'Search in this list',
			anyStatus: 'Any status',
			anyFormat: 'Any format',
			anyGenre: 'Any genre',
			noMatches: 'No title in this list matches those filters',
			reset: 'Reset',
			sort: {
				default: 'List order',
				title: 'Title',
				score: 'Your score',
				progress: 'Progress',
				updated: 'Recently updated'
			}
		},
		mediaType: {
			movie: 'Movies',
			series: 'Series',
			dorama: 'Doramas',
			anime: 'Anime',
			book: 'Books',
			manga: 'Manga'
		},
		sort: {
			recent: 'Recently updated',
			name: 'Name',
			size: 'Most titles'
		},
		view: {
			grid: 'Grid view',
			rows: 'List view'
		},
		card: {
			empty: 'Empty',
			updated: 'Updated {{when}}',
			overflow: '+{{count}}'
		},
		shortcut: {
			watchlist: 'Watchlist',
			watchlistHint: 'Titles you plan to watch or read',
			completed: 'Completed',
			completedHint: 'Everything you finished',
			current: 'Currently watching'
		},
		manage: {
			new: 'New list',
			createTitle: 'Create list',
			createSubtitle: 'A list holds one media type, so its titles stay where they belong',
			renameTitle: 'Edit list',
			create: 'Create list',
			save: 'Save',
			rename: 'Rename',
			delete: 'Delete',
			deleteTitle: 'Delete “{{name}}”?',
			deleteHintAniList:
				'The list is removed from your AniList account. The titles in it stay in your lists',
			deleteHintLocal: 'The list is removed from this computer. The titles in it stay in your lists',
			options: 'List options',
			nameLabel: 'List name',
			nameHint: 'You can rename it later',
			iconLabel: 'Icon',
			iconHint: 'Shown next to the list name. Leave it on the default if none fits',
			iconDefault: 'Default',
			iconSearch: 'Search icons',
			iconCount: '{{count}} icons',
			iconNoMatches: 'No icon by that name',
			namePlaceholder: 'e.g. Watch later',
			typeLabel: 'Media type',
			typeHintAniList: 'Anime and manga lists are created in your AniList account',
			typeHintLocal: 'This list is stored on this computer',
			typeLocked: 'A list keeps the media type it was created with',
			duplicate: 'A list with that name already exists',
			notConnected: 'Connect AniList to create anime and manga lists',
			offline: 'AniList is unreachable, so this list cannot be changed right now',
			failed: 'Could not save the list. Try again'
		},
		addEntry: {
			action: 'Add to list',
			title: 'Add to list',
			save: 'Add',
			done: 'Added {{title}} to your AniList list'
		},
		manageEntry: {
			action: 'Manage lists',
			title: 'Manage lists',
			save: 'Save changes',
			statusHint: 'Where this title sits in your AniList lists',
			lists: 'Lists',
			listsHint: 'Tap a list to add or remove this title',
			listsEmpty: 'No custom list for this media type yet'
		},
		rateEntry: {
			action: 'Rate & notes',
			title: 'Rate & notes',
			scoreHint: 'Your score in the format your AniList account uses',
			progressHint: 'Kept in sync with your AniList list',
			repeatHint: 'How many times you went through it again',
			started: {
				anime: 'Started watching',
				manga: 'Started reading'
			},
			dateHint: 'Optional — leave it blank if you are not sure',
			completed: {
				anime: 'Finished watching',
				manga: 'Finished reading'
			},
			completedLocked: 'Available once the title is completed, dropped or repeating',
			notes: 'Notes',
			notesHint: 'Private notes only you can see',
			notesPlaceholder: 'Anything you want to remember'
		},
		removeFromList: 'Remove from list',
		loading: 'Loading your lists…',
		failed: 'Could not load your lists',
		retry: 'Retry',
		empty: 'Nothing here yet',
		connect: 'Connect AniList to see your lists',
		pending: 'Not synced yet',
		menu: 'Title options',
		decrement: 'One less',
		increment: 'One more',
		updateFailed: 'Could not save the change. Try again',
		sync: {
			progress: 'Syncing with AniList…',
			done: 'Synced with AniList',
			delayed: 'Saved on this computer. It will reach AniList once it is reachable'
		},
		episodes: 'Ep. {{progress}}',
		chapters: 'Ch. {{progress}}',
		editor: {
			status: 'Status',
			score: 'Score',
			episodes: 'Episodes',
			chapters: 'Chapters',
			volumes: 'Volumes',
			repeat: 'Repeat'
		},
		status: {
			anime: {
				CURRENT: 'Watching',
				PLANNING: 'Plan to watch',
				COMPLETED: 'Completed',
				DROPPED: 'Dropped',
				PAUSED: 'Paused',
				REPEATING: 'Rewatching'
			},
			manga: {
				CURRENT: 'Reading',
				PLANNING: 'Plan to read',
				COMPLETED: 'Completed',
				DROPPED: 'Dropped',
				PAUSED: 'Paused',
				REPEATING: 'Rereading'
			}
		}
	},

	library: {
		description: 'Managing local files, folders, and title mappings',
		summary: {
			files_one: '{{count}} file',
			files_few: '{{count}} files',
			files_many: '{{count}} files',
			files_other: '{{count}} files',
			filesOf_one: '{{count}}/{{total}} episode',
			filesOf_few: '{{count}}/{{total}} episodes',
			filesOf_many: '{{count}}/{{total}} episodes',
			filesOf_other: '{{count}}/{{total}} episodes',
			unmatched_one: '{{count}} unmatched',
			unmatched_few: '{{count}} unmatched',
			unmatched_many: '{{count}} unmatched',
			unmatched_other: '{{count}} unmatched',
			titles_one: '{{count}} title',
			titles_few: '{{count}} titles',
			titles_many: '{{count}} titles',
			titles_other: '{{count}} titles'
		},
		empty: {
			title: 'No library folders yet',
			description:
				'Point the node at a folder with your files. It walks subfolders too and matches what it finds to fill in the details automatically',
			action: 'Add a folder in settings'
		},
		root: {
			add: 'Add folder',
			remove: 'Stop watching this folder',
			removeFailed: 'Could not stop watching that folder',
			failed: 'Could not add that folder',
			overlap: 'That folder overlaps one the node already watches',
			files_one: '{{count}} file',
			files_few: '{{count}} files',
			files_many: '{{count}} files',
			files_other: '{{count}} files',
			missing_one: '{{count}} missing',
			missing_few: '{{count}} missing',
			missing_many: '{{count}} missing',
			missing_other: '{{count}} missing',
			section: 'Library roots',
			menu: 'Folder actions',
			rescan: 'Rescan this folder',
			none: 'No folders yet'
		},
		scan: {
			start: 'Scan',
			folders: 'Folders',
			allFolders: 'Every library folder',
			failed: 'The scan could not be started',
			noRoots: 'Add a library folder in Settings before scanning',
			running: 'Scanning…',
			title: 'Scanning the library',
			walking: 'Walking folders',
			probing: 'Reading durations',
			matching: 'Matching titles',
			roots_one: '{{done}} of {{count}} folder',
			roots_few: '{{done}} of {{count}} folders',
			roots_many: '{{done}} of {{count}} folders',
			roots_other: '{{done}} of {{count}} folders',
			foundFiles_one: '{{count}} file found',
			foundFiles_few: '{{count}} files found',
			foundFiles_many: '{{count}} files found',
			foundFiles_other: '{{count}} files found',
			ofTotal: '{{done}} of {{total}}',
			neverRun: 'Not scanned yet',
			finished: 'Finished {{when}}',
			matchedFiles_one: '{{count}} matched',
			matchedFiles_few: '{{count}} matched',
			matchedFiles_many: '{{count}} matched',
			matchedFiles_other: '{{count}} matched',
			allRead: 'Every folder read',
			tally: {
				added: 'New',
				changed: 'Changed',
				missing: 'Gone'
			},
			failedTitle: 'Could not read:',
			showMore_one: 'Show {{count}} more',
			showMore_few: 'Show {{count}} more',
			showMore_many: 'Show {{count}} more',
			showMore_other: 'Show {{count}} more',
			showLess: 'Show less',
			failures: 'Folders that could not be read',
			rootFailed: 'A folder could not be read: {{reason}}'
		},
		explorer: {
			title: 'Library explorer',
			search: 'Search files and folders…',
			nothing: 'Nothing matches this filter',
			pickSomething: 'Pick a file or a folder to see what the node knows about it',
			folderMeta: '{{matched}} of {{count}} matched',
			selectRow: 'Select {{name}}',
			extension: '{{extension}} file',
			folder: 'Folder',
			path: 'Path',
			libraryFile: 'Library file',
			files: 'Files',
			matchedTitle: 'Title',
			season: 'Season',
			episode: 'Episode',
			duration: 'Duration',
			size: 'Size',
			kind: 'Type',
			form: 'Form',
			unmatchedPill_one: '{{count}} unmatched file',
			unmatchedPill_few: '{{count}} unmatched files',
			unmatchedPill_many: '{{count}} unmatched files',
			unmatchedPill_other: '{{count}} unmatched files',
			matchFiles_one: 'Match {{count}} file',
			matchFiles_few: 'Match {{count}} files',
			matchFiles_many: 'Match {{count}} files',
			matchFiles_other: 'Match {{count}} files',
			unmatchFiles_one: 'Unmatch {{count}} file',
			unmatchFiles_few: 'Unmatch {{count}} files',
			unmatchFiles_many: 'Unmatch {{count}} files',
			unmatchFiles_other: 'Unmatch {{count}} files',
			ignoreFiles_one: 'Ignore {{count}} file',
			ignoreFiles_few: 'Ignore {{count}} files',
			ignoreFiles_many: 'Ignore {{count}} files',
			ignoreFiles_other: 'Ignore {{count}} files',
			unignoreFiles_one: 'Un-ignore {{count}} file',
			unignoreFiles_few: 'Un-ignore {{count}} files',
			unignoreFiles_many: 'Un-ignore {{count}} files',
			unignoreFiles_other: 'Un-ignore {{count}} files',
			deleteFiles_one: 'Delete {{count}} file',
			deleteFiles_few: 'Delete {{count}} files',
			deleteFiles_many: 'Delete {{count}} files',
			deleteFiles_other: 'Delete {{count}} files',
			deleteTitle_one: 'Delete {{count}} file from disk?',
			deleteTitle_few: 'Delete {{count}} files from disk?',
			deleteTitle_many: 'Delete {{count}} files from disk?',
			deleteTitle_other: 'Delete {{count}} files from disk?',
			andMore_one: 'and {{count}} more',
			andMore_few: 'and {{count}} more',
			andMore_many: 'and {{count}} more',
			andMore_other: 'and {{count}} more',
			filterAction: 'Filter',
			filterActive: 'Filter: {{filter}}',
			select: 'Select',
			selecting: 'Selecting',
			refresh: 'Reload the tree',
			kinds: {
				video: 'Video',
				manga: 'Comic',
				book: 'Book'
			},
			filter: {
				unmatched: 'Unmatched files',
				auto: 'Matched by the node',
				ignored: 'Ignored files',
				missing: 'Missing files'
			}
		},
		toolbar: {
			explorer: 'Library explorer',
			refresh: 'Refresh',
			refreshHint: 'Rescan the library',
			scanHint: 'Scan the library',
			resolveUnmatched_one: 'Resolve unmatched ({{count}})',
			resolveUnmatched_few: 'Resolve unmatched ({{count}})',
			resolveUnmatched_many: 'Resolve unmatched ({{count}})',
			resolveUnmatched_other: 'Resolve unmatched ({{count}})',
			ignoredFiles: 'Ignored files',
			scanSummaries: 'Scan summaries',
			more: 'More library actions'
		},
		unmatched: {
			title: 'Unmatched files',
			empty: 'Every file has a title',
			previous: 'Previous',
			next: 'Next',
			sourceId: 'AniList ID',
			matchSelection: 'Match selection',
			selectAll: 'Select all files',
			fetchSuggestions: 'Fetch suggestions',
			ignoreSelection: 'Ignore selection',
			pickTitle: 'Select a title',
			confidence: '{{percent}}% match',
			onYourList: 'On your list',
			ignoredTitle: 'Ignored files',
			noneIgnored: 'No ignored files',
			unignoreSelection: 'Un-ignore selection',
			ignoreFailed_one: '{{count}} file could not be set aside',
			ignoreFailed_few: '{{count}} files could not be set aside',
			ignoreFailed_many: '{{count}} files could not be set aside',
			ignoreFailed_other: '{{count}} files could not be set aside'
		},
		history: {
			title: 'Scan summaries',
			description: 'Every scan the node has run',
			empty: 'No scans yet',
			partial: 'Interrupted',
			matchedTitle: 'Matched titles',
			unmatchedTitle: 'Could not match',
			notYetOnYourList: 'Not yet on your list',
			nothingToShow: 'This scan found nothing to report',
			search: 'Search file names…',
			scanned_one: 'Scanned {{count}} title',
			scanned_few: 'Scanned {{count}} titles',
			scanned_many: 'Scanned {{count}} titles',
			scanned_other: 'Scanned {{count}} titles',
			notMatched_one: '{{count}} file was not matched',
			notMatched_few: '{{count}} files were not matched',
			notMatched_many: '{{count}} files were not matched',
			notMatched_other: '{{count}} files were not matched',
			onYourList: 'On your list',
			filesScanned_one: '{{count}} file scanned',
			filesScanned_few: '{{count}} files scanned',
			filesScanned_many: '{{count}} files scanned',
			filesScanned_other: '{{count}} files scanned',
			openExplorer: 'Open in Library Explorer',
			scannerLogs: 'View scanner logs',
			parsedTitle: 'Read from the name:',
			logMatched: 'Matched at {{percent}}%',
			logRejected: 'Closest title scored {{percent}}%, below the threshold',
			logNothing: 'Nothing to compare it with'
		},
		search: 'Search by title, name or file…',
		view: {
			all: 'All',
			unmatched: 'Unmatched',
			missing: 'Missing'
		},
		group: {
			matched: 'Matched',
			unmatched: 'Unmatched',
			season: 'Season {{number}}',
			seasons_one: '{{count}} season',
			seasons_few: '{{count}} seasons',
			seasons_many: '{{count}} seasons',
			seasons_other: '{{count}} seasons',
			episodes_one: '{{count}} episode',
			episodes_few: '{{count}} episodes',
			episodes_many: '{{count}} episodes',
			episodes_other: '{{count}} episodes',
			more_one: '{{count}} more episode',
			more_few: '{{count}} more episodes',
			more_many: '{{count}} more episodes',
			more_other: '{{count}} more episodes',
			less: 'Show fewer'
		},
		loading: 'Reading the library…',
		failed: 'The node did not return the library',
		retry: 'Try again',
		noFiles: 'Nothing scanned yet',
		noFilesHint: 'Press Scan to walk the folders you added',
		noMatches: 'No files match this filter',
		truncated: 'Showing {{shown}} of {{total}} files',
		file: {
			missing: 'Missing',
			matched: 'Matched {{percent}}%',
			matchedByHand: 'Matched by hand',
			unmatched: 'Unmatched',
			play: 'Play',
			match: 'Match',
			change: 'Change',
			clear: 'Forget this match',
			ignore: 'Leave this file alone',
			unignore: 'Stop leaving it alone',
			ignored: 'Set aside',
			ignoreFailed: 'Could not set that file aside',
			deleteFile: 'Delete from disk',
			deleteFileTitle: 'Delete this file?',
			deleteFileWarning: 'The file is removed from this computer. This cannot be undone.',
			deleteFailed: 'Could not delete that file',
			unknownTitle: 'Unrecognized',
			season: 'Season {{number}}',
			episode: 'Episode {{number}}',
			chapter: 'Chapter {{number}}',
			menu: 'File actions',
			reveal: 'Show in folder'
		},
		form: {
			series: 'Episode',
			movie: 'Film',
			special: 'Special',
			extra: 'Extra',
			manga: 'Chapter',
			book: 'Book'
		},
		match: {
			group_one: '{{count}} file will be matched to the title you pick',
			group_few: '{{count}} files will be matched to the title you pick',
			group_many: '{{count}} files will be matched to the title you pick',
			group_other: '{{count}} files will be matched to the title you pick',
			someFailed_one: '{{count}} file could not be matched',
			someFailed_few: '{{count}} files could not be matched',
			someFailed_many: '{{count}} files could not be matched',
			someFailed_other: '{{count}} files could not be matched',
			title: 'What is this file?',
			loading: 'Asking the source…',
			loadFailed: 'Could not load candidates',
			failed: 'Could not save the match',
			none: 'No candidates',
			noneHint:
				'Nothing the source knows is close enough to this name. Renaming the file closer to its title usually helps',
			tracked: 'On your list',
			noSource: 'No metadata source is connected',
			offline: 'The node is unreachable'
		}
	},

	media: {
		searchTorrents: 'Search torrents',
		downloadMissing_one: 'Download · {{count}} missing',
		downloadMissing_few: 'Download · {{count}} missing',
		downloadMissing_many: 'Download · {{count}} missing',
		downloadMissing_other: 'Download · {{count}} missing',
		back: 'Back',
		failed: 'Could not load this title',
		retry: 'Retry',
		offline: 'Details are unavailable right now. Showing what your list knows',
		openOn: 'Open on {{name}}',
		addToList: 'Add to list',
		trailer: 'Trailer',
		trailerFor: 'Trailer for {{title}}',
		downloadBatch: 'Download batch / {{count}} episodes',
		comingSoon: 'Coming soon',
		nextAiringDay: 'Episode {{episode}} {{when}}',
		views: {
			library: 'Local library',
			torrent: 'Torrents'
		},
		chapters: {
			title: 'Chapters · {{count}}'
		},
		library: {
			notInLibrary: 'Not in your library',
			episodesNotInLibrary: 'The following episodes are not in your library:',
			episode: 'Episode {{number}}',
			metadataUnavailable: 'No source has episode details for this title yet',
			andMore: 'And more…',
			toWatch: 'Next to watch',
			specials: 'Specials',
			others: 'Others',
			play: 'Play {{name}}',
			playing: 'Playing',
			watched: 'Watched',
			missing: 'File not found on the last scan',
			minutes: '{{count}}m',
			aired: 'Aired {{date}}',
			about: 'About this episode',
			previous: 'Previous episodes',
			next: 'Next episodes'
		},
		menu: {
			label: 'More actions',
			details: 'Details',
			addToLibrary: 'Add to library'
		},
		sections: {
			synopsis: 'Synopsis',
			details: 'Details',
			relations: 'Related titles'
		},
		noDescription: 'No description yet',
		stats: {
			averageScore: 'Average score',
			popularity: 'Members',
			favourites: 'Favourites'
		},
		fields: {
			format: 'Format',
			status: 'Status',
			episodes: 'Episodes',
			chapters: 'Chapters',
			volumes: 'Volumes',
			duration: 'Episode length',
			start: 'Start',
			end: 'End',
			studios: 'Studios',
			source: 'Source',
			country: 'Country',
			synonyms: 'Also known as'
		},
		minutes: '{{count}} min',
		format: {
			TV: 'TV',
			TV_SHORT: 'TV short',
			MOVIE: 'Movie',
			SPECIAL: 'Special',
			OVA: 'OVA',
			ONA: 'ONA',
			MUSIC: 'Music',
			MANGA: 'Manga',
			NOVEL: 'Light novel',
			ONE_SHOT: 'One-shot'
		},
		status: {
			FINISHED: 'Finished',
			RELEASING: 'Releasing',
			NOT_YET_RELEASED: 'Not yet released',
			CANCELLED: 'Cancelled',
			HIATUS: 'On hiatus'
		},
		season: {
			WINTER: 'Winter',
			SPRING: 'Spring',
			SUMMER: 'Summer',
			FALL: 'Fall'
		},
		relation: {
			ADAPTATION: 'Adaptation',
			PREQUEL: 'Prequel',
			SEQUEL: 'Sequel',
			PARENT: 'Parent story',
			SIDE_STORY: 'Side story',
			CHARACTER: 'Character',
			SUMMARY: 'Summary',
			ALTERNATIVE: 'Alternative',
			SPIN_OFF: 'Spin-off',
			OTHER: 'Other',
			SOURCE: 'Source',
			COMPILATION: 'Compilation',
			CONTAINS: 'Contains'
		},
		origin: {
			ORIGINAL: 'Original',
			MANGA: 'Manga',
			LIGHT_NOVEL: 'Light novel',
			VISUAL_NOVEL: 'Visual novel',
			VIDEO_GAME: 'Video game',
			OTHER: 'Other',
			NOVEL: 'Novel',
			DOUJINSHI: 'Doujinshi',
			ANIME: 'Anime',
			WEB_NOVEL: 'Web novel',
			LIVE_ACTION: 'Live action',
			GAME: 'Game',
			COMIC: 'Comic',
			MULTIMEDIA_PROJECT: 'Multimedia project',
			PICTURE_BOOK: 'Picture book'
		}
	},

	search: {
		subtitle: 'Find anime, manga, dramas, films, series and books',
		searchPlaceholder: 'Title',
		searchLabel: 'Search by title',
		filters: 'Filters',
		clear: 'Clear filters',
		adult: 'Show adult content',
		empty: 'Nothing found. Try a different name or change the filters',
		failed: 'Could not search right now',
		loadMoreFailed: 'Could not load more titles',
		retry: 'Retry',
		loadMore: 'Show more',
		scoreAtLeast: '{{score}}% and above',
		type: {
			anime: 'Anime',
			manga: 'Manga',
			movie: 'Movies',
			series: 'Series',
			dorama: 'Doramas'
		},
		sort: {
			POPULARITY_DESC: 'Most popular',
			SEARCH_MATCH: 'Best match',
			TRENDING_DESC: 'Trending now',
			SCORE_DESC: 'Highest scored',
			FAVOURITES_DESC: 'Most favourited',
			START_DATE_DESC: 'Newest first',
			TITLE_ROMAJI: 'By title'
		},
		any: {
			genres: 'All genres',
			tags: 'All tags',
			formats: 'All formats',
			seasons: 'Any season',
			year: 'Any year',
			statuses: 'Any status',
			score: 'Any score'
		}
	},

	player: {
		play: 'Play',
		pause: 'Pause',
		mute: 'Mute',
		unmute: 'Unmute',
		volume: 'Volume',
		seek: 'Position',
		audio: 'Audio track',
		subtitles: 'Subtitles',
		subtitlesOff: 'Off',
		fullscreen: 'Full screen',
		exitFullscreen: 'Exit full screen',
		minimize: 'Back to the page',
		expand: 'Open the player',
		failed: 'The built-in player could not play this file.',
		loadFailed: 'Could not read this file.',
		needsTranscode: 'This file uses codecs the built-in player cannot decode yet. It plays in mpv.',
		openExternally: 'Open in mpv'
	},
	reader: {
		close: 'Back',
		pageAlt: 'Page {{number}}',
		empty: 'This chapter has no pages the reader can show.',
		counted: 'Counted as read',
		read: 'Read',
		loadFailed: 'Could not open this chapter.',
		seek: 'Page',
		previousChapter: 'Previous chapter',
		nextChapter: 'Next chapter',
		pageOf: '{{current}} / {{total}}',
		end: 'End of the chapter',
		chapterNumber: 'Chapter {{number}}'
	},
	playback: {
		episode: 'Episode {{number}}',
		watched: 'Counted as watched',
		pause: 'Pause',
		resume: 'Resume',
		stop: 'Close the player',
		failed: 'Could not start the player'
	},

	placeholder: {
		discover: 'Recommendations and fresh releases will live here once the cloud catalog is connected',
		downloads: 'Torrent providers and the download queue handled by the node'
	},

	mangaSources: {
		none: 'No servers yet',
		add: 'Add OPDS server',
		menu: 'Server actions',
		edit: 'Edit',
		remove: 'Remove',
		removeFailed: 'Could not remove the server',
		saveFailed: 'Could not save the server',
		drawer: {
			createTitle: 'Add OPDS server',
			editTitle: 'Edit OPDS server',
			description:
				'Address of the catalogue’s root feed, such as http://nas:25600/opds/v1.2/catalog for Komga',
			nameLabel: 'Name',
			namePlaceholder: 'Komga at home',
			urlLabel: 'Address',
			usernameLabel: 'User name',
			passwordLabel: 'Password',
			passwordHint: 'The node keeps it in a file of its own and never shows it again',
			passwordKept: 'Leave empty to keep the stored password',
			create: 'Add',
			save: 'Save',
			check: 'Check connection',
			ok: 'Connected',
			problems: {
				unauthorized: 'The server refused the user name or password',
				not_opds: 'This address does not serve an OPDS catalogue',
				unreachable: 'The server could not be reached',
				other_host: 'The catalogue points to another server'
			}
		},
		chapters: {
			external: 'On the publisher’s site',
			library: 'Library',
			all: 'All sources',
			filter: 'Source',
			copies: 'Other copies',
			link: 'Find on a server',
			relink: 'Change series',
			unlink: 'Unlink',
			from: 'from {{name}}',
			empty: 'The linked series has no chapters that can be read page by page',
			loadFailed: 'Could not load online chapters',
			pages_one: '{{count}} page',
			pages_few: '{{count}} pages',
			pages_many: '{{count}} pages',
			pages_other: '{{count}} pages'
		},
		mangadex: {
			enable: 'Read chapters from MangaDex',
			languages: 'Languages, in order of preference',
			languagesPlaceholder: 'Choose languages',
			note: 'Pages are read online through the node and are not saved. MangaDex and the translators are named next to every chapter.',
			unavailable: 'MangaDex is turned off on this node',
			saveFailed: 'Could not save the MangaDex settings'
		},
		downloads: {
			save: 'Save to disk',
			saveAll: 'Save all to disk',
			queued_one: '{{count}} chapter queued',
			queued_few: '{{count}} chapters queued',
			queued_many: '{{count}} chapters queued',
			queued_other: '{{count}} chapters queued',
			failedToQueue: 'Could not queue the download',
			folderTitle: 'Where to save chapters',
			folderDescription:
				'Chapters are saved as CBZ files in a library folder, so they are in the library at once',
			noFolders: 'Add a library folder in the settings first',
			folderPlaceholder: 'Choose a folder',
			title: 'Manga chapters',
			empty: 'Nothing saved yet',
			cancel: 'Stop',
			retry: 'Try again',
			forget: 'Remove from the list',
			progress: '{{done}} / {{total}} pages',
			states: {
				queued: 'Waiting',
				running: 'Saving',
				done: 'Saved',
				failed: 'Failed',
				cancelled: 'Stopped'
			}
		},
		link: {
			matched: 'Matches AniList',
			title: 'Find the series',
			description: 'Pick the series that holds this title’s chapters',
			sourceLabel: 'Server',
			searchLabel: 'Series name',
			search: 'Search',
			noResults: 'Nothing found on this server',
			choose: 'Use',
			failed: 'Could not link the series'
		}
	},
	torrents: {
		section: {
			hint: 'Search for releases, add your own, and get new episodes by themselves'
		},
		setup: {
			openSettings: 'Open settings',
			noClient: 'No torrent client',
			noClientHint: 'Choose the built-in client or connect qBittorrent in the settings.',
			unreachable: 'The torrent client does not answer',
			noSources: 'No search source',
			noSourcesHint: 'Add Jackett or Prowlarr in the settings to search for releases.'
		},
		add: 'Add torrent',
		drawer: {
			title: 'Add a torrent',
			description: 'For {{title}}. Once downloaded, its videos join the library under this title.',
			magnetLabel: 'Magnet link',
			magnetPlaceholder: 'magnet:?xt=urn:btih:…',
			fileLabel: 'Or a .torrent file',
			chooseFile: 'Choose a .torrent file',
			clearFile: 'Remove the file',
			fileUnreadable: 'Could not read this file',
			submit: 'Download',
			failed: 'Could not add the torrent',
			chooseFiles: 'Choose the episodes before downloading'
		},
		files: {
			title: 'Choose files',
			choose: 'Choose files',
			start: 'Download selected',
			save: 'Save',
			failed: 'Could not change the files',
			loading: 'Loading the file list…',
			waiting: 'Waiting for the torrent’s file list. A magnet link gets it from its peers first.',
			selected: '{{count}} selected · {{size}}',
			hint: 'Episodes already in your library are left out',
			all: 'All',
			missing: 'Missing episodes',
			none: 'None',
			episode: 'Ep. {{number}}',
			inLibrary: 'in library'
		},
		search: {
			addedMany_one: 'Added {{count}} download',
			addedMany_few: 'Added {{count}} downloads',
			addedMany_many: 'Added {{count}} downloads',
			addedMany_other: 'Added {{count}} downloads',
			covers_one: '{{count}} missing episode',
			covers_few: '{{count}} missing episodes',
			covers_many: '{{count}} missing episodes',
			covers_other: '{{count}} missing episodes',
			noEpisode: 'No episode in the name',
			emptyHint: 'Try another query, or turn the filters off.',
			results_one: '{{count}} result',
			results_few: '{{count}} results',
			results_many: '{{count}} results',
			results_other: '{{count}} results',
			onlyMissing: 'Only with missing episodes',
			kind: {
				label: 'Releases',
				all: 'All',
				episodes: 'Episodes',
				batches: 'Batches'
			},
			downloadSelected: 'Download ({{count}})',
			nothingMissing: 'No episode is missing',
			missing: 'Missing episodes:',
			open: 'Search torrents',
			drawerTitle: 'Search torrents',
			placeholder: 'Search by the title’s names, or type your own query',
			episode: 'Episode',
			submit: 'Search',
			best: 'Best',
			bestIs: 'Best match: {{title}}',
			downloadBest: 'Download best',
			queries: 'Searched for: {{queries}}',
			noSources: 'Add Jackett or Prowlarr in the settings to search for releases.',
			failed: 'The search failed',
			sourceFailed: '{{name}} did not answer: {{error}}',
			empty: 'Nothing found',
			download: 'Download',
			added: 'Added to the downloads',
			page: 'Open the release page',
			episodes: 'Ep. {{from}}–{{to}}',
			match: {
				episode: 'This episode',
				batch: 'Batch'
			}
		},
		sources: {
			none: 'No search source yet',
			add: 'Add a source',
			edit: 'Change',
			remove: 'Remove',
			menu: 'Source actions',
			removeFailed: 'Could not remove the source',
			createTitle: 'Add a search source',
			editTitle: 'Change the search source',
			description: 'A Torznab feed from Jackett or Prowlarr. Which sites it searches is set up there.',
			nameLabel: 'Name',
			urlLabel: 'Torznab address',
			urlHint:
				'Jackett: Copy Torznab Feed on an indexer, or the “all” feed. Prowlarr: an indexer’s Torznab URL',
			keyLabel: 'API key',
			keyKept: 'Leave empty to keep the saved key',
			keyHint: 'Shown on the Jackett or Prowlarr dashboard',
			check: 'Check the source',
			ok: '{{title}} answers and can search',
			noSearch: '{{title}} answers but does not take searches',
			unreachable: 'The source did not answer',
			save: 'Save',
			create: 'Add',
			saveFailed: 'Could not save the source'
		},
		profile: {
			resolution: 'Resolution',
			codec: 'Codec',
			any: 'Any',
			minSeeders: 'Minimum seeders',
			preferred: 'Preferred words, best first — groups, sites',
			excluded: 'Never pick releases with these words',
			save: 'Save preferences',
			saveFailed: 'Could not save the preferences'
		},
		auto: {
			addedToast_one: 'Added {{count}} download',
			addedToast_few: 'Added {{count}} downloads',
			addedToast_many: 'Added {{count}} downloads',
			addedToast_other: 'Added {{count}} downloads',
			queryShort: 'searching “{{query}}”',
			emptyHint: 'Turn on auto-download on a title’s Torrents tab.',
			emptyTitle: 'No rules yet',
			intro: 'Rules search your sources every 30 minutes and add the best release of each new episode. A rule is turned on and tuned on its title’s Torrents tab.',
			settings: 'Rule settings',
			panelHint: 'New episodes download by themselves, checked every 30 minutes',
			panelTitle: 'Auto-download',
			enable: 'Download new episodes automatically',
			remove: 'Remove the rule',
			hint: 'Every 30 minutes Mediary searches your sources and adds the best release of each episode the library is missing, taking from a batch only the episodes that are missing.',
			from: 'From episode',
			fromShort: 'from episode {{episode}}',
			query: 'Search for',
			queryPlaceholder: 'The title’s names',
			save: 'Save',
			preview: 'Preview',
			checkNow: 'Check now',
			lastChecked_one: 'Checked {{when}}, added {{count}}',
			lastChecked_few: 'Checked {{when}}, added {{count}}',
			lastChecked_many: 'Checked {{when}}, added {{count}}',
			lastChecked_other: 'Checked {{when}}, added {{count}}',
			nothing: 'Nothing new to download',
			wouldAdd_one: 'Would add {{count}} episode',
			wouldAdd_few: 'Would add {{count}} episodes',
			wouldAdd_many: 'Would add {{count}} episodes',
			wouldAdd_other: 'Would add {{count}} episodes',
			added_one: 'Added {{count}} episode',
			added_few: 'Added {{count}} episodes',
			added_many: 'Added {{count}} episodes',
			added_other: 'Added {{count}} episodes',
			saveFailed: 'Could not save the rule',
			checkFailed: 'The check failed',
			listTitle: 'Auto-download',
			on: 'On',
			off: 'Off'
		},
		list: {
			emptyForTitleHint: 'Search for releases or add a magnet link.',
			emptyHint: 'Search for a release on a title’s Torrents tab.',
			inLibrary: 'In library: {{count}}',
			active: 'Active: {{count}}',
			title: 'Torrents',
			forTitle: 'Downloads for this title',
			empty: 'No torrent downloads yet',
			emptyForTitle: 'Nothing downloaded for this title yet'
		},
		states: {
			choosing: 'Waiting for your choice of files',
			downloading: 'Downloading',
			paused: 'Paused',
			stalled: 'Looking for peers',
			queued: 'Queued in qBittorrent',
			checking: 'Checking files',
			metadata: 'Fetching the torrent’s metadata',
			error: 'qBittorrent reports an error',
			importing: 'Adding to the library',
			done: 'In Library',
			failed: 'Failed',
			unknown: 'Waiting for qBittorrent'
		},
		meta: {
			down: 'Download speed',
			speed: '{{speed}}/s',
			seeds: '{{seeds}} seeds · {{peers}} peers',
			eta: '{{time}} left',
			imported_one: '{{count}} local file',
			imported_few: '{{count}} local files',
			imported_many: '{{count}} local files',
			imported_other: '{{count}} local files'
		},
		pause: 'Pause',
		resume: 'Resume',
		remove: 'Remove from the list',
		removeWithFiles: 'Remove with the files',
		menu: 'Download actions',
		actionFailed: 'Could not change the download',
		client: {
			notConfigured: 'Choose a torrent client in the settings to download torrents',
			unreachable: 'qBittorrent is not answering: {{error}}',
			openSettings: 'Open settings'
		},
		settings: {
			clientLabel: 'Torrent client',
			embedded: 'Built-in',
			none: 'None',
			embeddedHint:
				'Mediary downloads torrents itself; nothing else to install. It listens for peers on port 42069 and does not open it on the router.',
			qbittorrentHint:
				'Your own qBittorrent, through its Web UI. Turn the Web UI on in qBittorrent: Options → Web UI.',
			noneHint: 'Torrents are off.',
			notConfigured: 'Not connected',
			configure: 'Connect',
			edit: 'Change',
			drawerTitle: 'Torrent client',
			drawerDescription: 'Which client downloads torrents for the library.',
			urlLabel: 'Web UI address',
			usernameLabel: 'Username',
			passwordLabel: 'Password',
			passwordKept: 'Leave empty to keep the saved password',
			passwordHint: 'Leave empty if the Web UI lets this computer in without one',
			check: 'Check the connection',
			ok: 'Connected to qBittorrent {{version}}',
			folderLabel: 'Download folder',
			folderHint: 'The library folder torrents are saved into, one subfolder per title',
			folderPlaceholder: 'Choose a library folder',
			mappingLabel: 'Path mapping',
			mappingHint:
				'Only when qBittorrent runs in Docker or on another computer and sees the download folder under another path. Fill in both or neither.',
			mappingClient: 'The folder as qBittorrent sees it',
			mappingNode: 'The same folder on this computer',
			save: 'Save',
			saveFailed: 'Could not save the settings'
		}
	},
	downloads: {
		subtitle: 'Torrents, the rules that add them by themselves, and saved manga chapters',
		tabs: {
			torrents: 'Torrents',
			auto: 'Auto-download',
			manga: 'Manga chapters'
		}
	},
	settings: {
		sections: {
			app: {
				title: 'App',
				subtitle: 'Appearance, language and first-time setup'
			},
			library: {
				title: 'Local library',
				subtitle: 'Folders the node scans for media'
			},
			player: {
				title: 'Video playback',
				subtitle: 'Which player opens your videos'
			},
			torrentClient: {
				title: 'Torrent client',
				subtitle: 'Where torrents are downloaded'
			},
			torrentSearch: {
				title: 'Torrent search',
				subtitle: 'Torznab sources for finding releases'
			},
			torrentPreferences: {
				title: 'Release preferences',
				subtitle: 'Which releases search ranks first'
			},
			mangaSources: {
				title: 'Manga sources',
				subtitle: 'OPDS catalogs with manga and books'
			},
			mangaDex: {
				title: 'MangaDex',
				subtitle: 'Reading chapters online'
			},
			mangaDownloads: {
				title: 'Manga downloads',
				subtitle: 'Where downloaded chapters are kept'
			}
		},
		mangaDex: {
			name: 'MangaDex',
			hint: 'Read chapters online from MangaDex'
		},
		mangaDownloads: {
			name: 'Manga downloads',
			hint: 'Library folder chapters are saved to, as CBZ files'
		},
		torrents: {
			name: 'Torrents',
			hint: 'The client that downloads torrents into your library'
		},
		torrentSearch: {
			name: 'Torrent search',
			hint: 'Your Jackett or Prowlarr, searched through Torznab. Mediary has no indexers of its own'
		},
		releaseProfile: {
			name: 'Release preferences',
			hint: 'What search ranks first and picks as the best release'
		},
		mangaSources: {
			name: 'Manga sources',
			hint: 'Your own OPDS catalogues — Komga, Kavita, Calibre-Web — to read chapters from'
		},
		appearance: {
			name: 'Appearance',
			hint: 'Light or dark surface for the whole app'
		},
		language: {
			name: 'Language',
			hint: 'Interface language. Catalog titles keep their own languages'
		},
		library: {
			name: 'Library folders',
			hint: 'Folders the node walks when it scans. Subfolders are included'
		},
		player: {
			name: 'Player',
			hint: 'Where episodes open: in the app or in mpv',
			modes: {
				builtin: 'Built-in',
				external: 'mpv'
			}
		},
		wizard: {
			name: 'Setup wizard',
			hint: 'Re-run first-time setup: folders, player, downloads',
			action: 'Open wizard'
		}
	},
	select: {
		placeholder: 'Select…',
		noResults: 'Nothing found',
		clear: 'Clear selection',
		remove: 'Remove {{label}}'
	},
	window: {
		minimize: 'Minimize',
		maximize: 'Maximize',
		restore: 'Restore',
		close: 'Close'
	},

	auth: {
		pitch: {
			titleLead: 'Your',
			titleAccent: 'media library',
			tagline:
				'Anime, manga, dramas, films, series and books — one catalog, one progress, across every device',
			aside: 'An account is only needed for the cloud catalog and sync. The local library, player and downloads work without one'
		},
		back: 'Go back',
		or: 'or',
		otherWay: 'Use a different sign-in method',
		providers: {
			label: 'Continue with',
			lastUsed: 'Last used',
			waiting: 'Waiting for {{provider}} in your browser',
			cancel: 'Cancel',
			unavailable: 'Could not load sign-in options',
			reload: 'Try again',
			failed: 'Could not sign in with {{provider}}. Please try again'
		},
		signIn: {
			eyebrow: 'Welcome back',
			title: 'Hi there!',
			subtitle: 'Choose how you want to sign in',
			emailTitle: 'Sign in',
			emailSubtitle: 'Sign in to continue where you left off',
			submit: 'Sign in',
			useEmail: 'Sign in with email and password',
			forgotPassword: 'Forgot password?',
			noAccount: 'No account yet?',
			switch: 'Create one'
		},
		signUp: {
			eyebrow: 'Join us',
			title: 'Create an account',
			subtitle: 'Choose how you want to sign up',
			emailTitle: 'Sign up',
			emailSubtitle: 'A few fields and you are done',
			submit: 'Sign up',
			useEmail: 'Sign up with email',
			haveAccount: 'Already have an account?',
			switch: 'Sign in'
		},
		field: {
			name: 'Name',
			email: 'Email',
			password: 'Password',
			passwordHint: 'Password, at least {{min}} characters',
			confirmation: 'Repeat the password',
			code: 'Confirmation code'
		},
		verify: {
			eyebrow: 'Almost there',
			title: 'Verify your email',
			description: 'Enter the {{length}}-digit code we sent to {{email}}',
			submit: 'Verify email',
			resendLabel: 'Did not get the code?',
			resend: 'Send a new one'
		},
		reset: {
			eyebrow: 'Account recovery',
			title: 'Reset password',
			description:
				'Enter the address you registered with. If it has an account, a code is already on its way',
			submit: 'Send reset code',
			backToSignIn: 'Back to sign in'
		},
		newPassword: {
			eyebrow: 'Almost done',
			title: 'New password',
			description: 'Enter the code sent to {{email}}, then choose a new password',
			submit: 'Save new password',
			requestAnother: 'Request a new code',
			remembered: 'Remembered your password? Sign in'
		},
		otp: {
			remaining: 'expires in {{time}}',
			expired: 'Code expired'
		},
		validation: {
			emailRequired: 'Enter your email',
			emailTooLong: 'Email must be at most {{max}} characters',
			emailInvalid: 'That email does not look right',
			nameRequired: 'Enter your name',
			nameLength: 'Name must be {{min}} to {{max}} characters',
			passwordRequired: 'Enter your password',
			passwordTooShort: 'Password must be at least {{min}} characters',
			passwordTooLong: 'Password must be at most {{max}} characters',
			passwordLength: 'Password must be {{min}} to {{max}} characters',
			passwordEchoesIdentity: 'The password must not repeat your email or name',
			confirmationRequired: 'Repeat the password',
			confirmationMismatch: 'The passwords do not match',
			codeRequired: 'Enter the code from the email',
			codeIncomplete: 'The code is {{length}} digits long',
			fieldInvalid: 'Check the “{{field}}” field'
		},
		error: {
			cloudUnreachable: 'Could not reach the cloud',
			requestFailed: 'The request failed'
		}
	},

	setup: {
		note: 'These settings can be changed later',
		railLabel: 'Setup steps',
		progress: 'Step {{current}} of {{total}}',
		previous: 'Previous',
		next: 'Next',
		finish: 'Finish',
		pending: 'This step is not built yet',
		steps: {
			library: {
				label: 'Local library',
				title: 'Local library',
				description:
					'Choose the folders your files already live in. Mediary scans them and matches what it finds against the catalog'
			},
			player: {
				label: 'Player',
				title: 'External media player',
				description:
					'Choose your preferred player for anime, films and series. Progress is tracked automatically'
			},
			downloads: {
				label: 'Downloads',
				title: 'Downloading',
				description: 'Configure your torrent client for downloading'
			},
			anilist: {
				label: 'AniList',
				title: 'Connect AniList',
				description:
					'Anime and manga lists live in your AniList account. Connect it once and Mediary keeps them in sync'
			},
			account: {
				label: 'Backup',
				title: 'Mediary account',
				description:
					'Optional. A Mediary account only keeps a backup of your lists and settings for your other devices'
			},
			debrid: {
				label: 'Debrid service',
				title: 'Debrid service',
				description: 'Debrid services offer faster downloads and instant streaming from the cloud'
			}
		},
		account: {
			blurb: 'A Mediary account is optional: it only backs up your lists and settings so you can move to another device',
			google: 'Continue with Google',
			or: 'or',
			email: 'Continue with email'
		},
		library: {
			placeholder: 'No folder selected',
			browse: 'Choose a folder',
			video: {
				label: 'Video',
				hint: 'Anime, films and series. Subfolders are scanned too'
			},
			reading: {
				label: 'Reading',
				hint: 'Manga, manhwa and books'
			},
			aside: 'You can skip this and add folders later — the catalog works without a local library'
		},
		player: {
			notice: "Mediary's node comes with a built-in player powered by mpv. You can still configure an external one below",
			select: {
				label: 'Desktop media player',
				mpv: 'MPV (Recommended)',
				vlc: 'VLC',
				custom: 'Custom command',
				hint: 'MPV is recommended for better subtitle rendering and torrent streaming'
			},
			install: 'On Windows, install MPV using Scoop or Chocolatey. On macOS, install MPV using Homebrew'
		},
		downloading: {
			client: {
				title: 'Torrent client',
				description: 'Client used to download torrents',
				label: 'Client',
				qbittorrent: 'qBittorrent'
			},
			qbittorrent: {
				title: 'qBittorrent settings',
				host: 'Host',
				username: 'Username',
				password: 'Password',
				port: 'Port',
				executable: 'Executable path'
			}
		},
		debrid: {
			label: 'Debrid service',
			none: 'None',
			torbox: 'TorBox',
			realDebrid: 'Real-Debrid',
			allDebrid: 'AllDebrid',
			premiumize: 'Premiumize'
		}
	},

	fallback: {
		notFound: {
			title: 'This screen does not exist',
			description: 'The address is wrong, or the screen has been removed',
			home: 'Back to home'
		},
		error: {
			title: 'Something went wrong',
			description: 'The screen could not be opened. Try again, or go back to home',
			retry: 'Try again'
		}
	},
	home: {
		subtitle: 'Phase 0 skeleton. No catalog yet — this only proves the shell can see the node',
		account: {
			title: 'Cloud account',
			anonymous: 'Not signed in — catalog and sync are unavailable',
			signIn: 'Sign in',
			signOut: 'Sign out'
		},
		node: {
			title: 'Local node',
			waiting: 'Waiting for the node to start…',
			pending: 'Requesting status…',
			failed: 'Could not query the node: {{error}}',
			version: 'Version',
			build: 'Build',
			linkedLabel: 'Cloud account',
			linked: 'linked',
			notLinked: 'not linked'
		}
	}
} as const
