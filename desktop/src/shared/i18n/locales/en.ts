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

	splash: {
		failed: 'The node failed to start. Check Settings for details.',
		continue: 'Continue anyway'
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
		addManually: 'Add title',
		downloads: 'Downloads',
		extensions: 'Extensions',
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
			current: 'In progress'
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
			done: 'Added {{title}} to your AniList list',
			doneLocal: 'Added {{title}} to your list'
		},
		manageEntry: {
			action: 'Manage lists',
			title: 'Manage lists',
			save: 'Save changes',
			statusHint: 'Where this title sits in your AniList lists',
			statusHintLocal: 'This title’s status on your own list',
			newList: 'New list',
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
				manga: 'Started reading',
				movie: 'Started watching',
				series: 'Started watching',
				dorama: 'Started watching',
				book: 'Started reading'
			},
			dateHint: 'Optional — leave it blank if you are not sure',
			completed: {
				anime: 'Finished watching',
				manga: 'Finished reading',
				movie: 'Finished watching',
				series: 'Finished watching',
				dorama: 'Finished watching',
				book: 'Finished reading'
			},
			completedLocked: 'Available once the title is completed, dropped or repeating',
			notes: 'Notes',
			notesHint: 'Private notes only you can see',
			notesPlaceholder: 'Anything you want to remember'
		},
		removeFromList: 'Remove from list',
		deleteEntry: 'Remove from my list',
		loading: 'Loading your lists…',
		failed: 'Could not load your lists',
		retry: 'Retry',
		empty: 'Nothing here yet',
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
			pages: 'Pages',
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
			},
			movie: {
				CURRENT: 'Watching',
				PLANNING: 'Plan to watch',
				COMPLETED: 'Completed',
				DROPPED: 'Dropped',
				PAUSED: 'Paused',
				REPEATING: 'Rewatching'
			},
			series: {
				CURRENT: 'Watching',
				PLANNING: 'Plan to watch',
				COMPLETED: 'Completed',
				DROPPED: 'Dropped',
				PAUSED: 'Paused',
				REPEATING: 'Rewatching'
			},
			dorama: {
				CURRENT: 'Watching',
				PLANNING: 'Plan to watch',
				COMPLETED: 'Completed',
				DROPPED: 'Dropped',
				PAUSED: 'Paused',
				REPEATING: 'Rewatching'
			},
			book: {
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
			note: 'A folder’s type tells the node what is inside. For videos it picks where names come from: anime from AniList, movies, series and doramas from TMDB. A video folder picks up comics and books too; a folder of manga or books keeps only those.',
			content: {
				anime: 'Anime',
				movies_and_shows: 'Movies & series',
				doramas: 'Doramas',
				manga: 'Manga',
				books: 'Books'
			},
			addAs: {
				anime: 'Folder of anime',
				movies_and_shows: 'Folder of movies & series',
				doramas: 'Folder of doramas',
				manga: 'Folder of manga',
				books: 'Folder of books'
			},
			switchTo: {
				anime: 'It holds anime',
				movies_and_shows: 'It holds movies & series',
				doramas: 'It holds doramas',
				manga: 'It holds manga only',
				books: 'It holds books only'
			},
			contentFailed: 'Could not change what the folder holds',
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
		failedHint: 'The source did not answer in time. Try again in a moment.',
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
			stream: 'Torrent streaming',
			torrent: 'Torrents'
		},
		stream: {
			autoSelect: 'Auto-select',
			autoSelectHint:
				'A click plays the best release of the episode through {{service}}, cached ones first when it can tell',
			autoSelectBuiltInHint:
				'A click plays the best-seeded release of the episode through the built-in client, as it downloads',
			manualHint: 'A click opens the search on the episode, to pick the release to play',
			via: 'Watch through',
			viaBuiltIn: 'Built-in client',
			settings: 'Streaming settings',
			settingsHint: 'Who gets the file, and whether a click picks the release on its own',
			explain:
				'An episode plays as it comes in, rather than waiting for the whole file. The built-in client fetches it from the torrent’s own swarm, free of charge, at whatever speed its seeders give. A debrid service fetches it on its own servers instead, so playback starts faster, often within seconds, and your own connection never joins the swarm.',
			debridPitch: 'No debrid service is set up',
			debridPitchHint:
				'Connect one in the settings for a faster start and without your address showing up to other peers.'
		},
		chapters: {
			title: 'Chapters · {{count}}'
		},
		books: {
			title: 'Files in your library'
		},
		library: {
			notInLibrary: 'Not in your library',
			episodesNotInLibrary: 'The following episodes are not in your library:',
			episode: 'Episode {{number}}',
			seasonEpisode: 'Season {{season}} · Episode {{number}}',
			season: 'Season {{number}}',
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
			relations: 'Related titles',
			recommendations: 'Recommendations',
			recommended: 'Recommended',
			similar: 'Similar'
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
			seasons: 'Seasons',
			episodes: 'Episodes',
			chapters: 'Chapters',
			volumes: 'Volumes',
			duration: 'Episode length',
			start: 'Start',
			end: 'End',
			studios: 'Studios',
			authors: 'Authors',
			pages: 'Pages',
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
			ONE_SHOT: 'One-shot',
			BOOK: 'Book'
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

	manualMedia: {
		createTitle: 'Add a title',
		createSubtitle:
			'Create a title no source knows. Fill in the minimum and let Claude help with the rest.',
		editTitle: 'Edit title',
		editSubtitle: 'It is your own data — changes save to this title only.',
		type: 'Kind',
		typeLocked: 'The kind cannot change once a title is saved.',
		save: 'Save',
		saved: 'Title added',
		updated: 'Title updated',
		saveFailed: 'Could not save the title',
		cancel: 'Cancel',
		addedManually: 'Added manually',
		editAction: 'Edit title',
		notEditable: 'This title cannot be edited.',
		notSpecified: 'Not specified',
		tagPlaceholder: 'Type a name and press Enter',
		genreSearchPlaceholder: 'Search genres…',
		fields: {
			title: 'Title',
			titlePlaceholder: 'e.g. Interstellar',
			originalTitle: 'Original title',
			originalTitlePlaceholder: 'If different from the title',
			synonyms: 'Also known as',
			synonymsHint: 'Other names — library files are matched against these too.',
			year: 'Year',
			startDate: 'Release date',
			endDate: 'End date',
			endYear: 'Ended',
			format: 'Format',
			status: 'Status',
			genres: 'Genres',
			studios: 'Studios',
			authors: 'Authors',
			seasons: 'Seasons',
			episodes: 'Episodes',
			chapters: 'Chapters',
			volumes: 'Volumes',
			pages: 'Pages',
			duration: 'Episode length (min)',
			score: 'Score',
			country: 'Country of origin',
			isAdult: 'Adult content',
			description: 'Description',
			descriptionPlaceholder: 'A short synopsis'
		},
		tabs: {
			basic: 'Basic info',
			details: 'Credits',
			description: 'Description'
		},
		sections: {
			params: 'Basic parameters',
			counts: 'Counts',
			releaseHistory: 'Release history',
			genres: 'Popular genres'
		},
		mode: {
			label: 'How to fill this in',
			ai: 'Fill with Claude',
			aiHint: 'Fill the fields in automatically',
			manual: 'By hand',
			manualHint: 'Fill everything in yourself'
		},
		status: {
			draft: 'Draft · Not saved yet',
			dirty: 'Draft · Unsaved changes',
			clean: 'All changes saved'
		},
		completeness: {
			title: 'Completeness',
			hint: 'How much of the title is filled in, grouped by how much it matters.',
			remaining_one: '{{count}} field left to fill in',
			remaining_few: '{{count}} fields left to fill in',
			remaining_many: '{{count}} fields left to fill in',
			remaining_other: '{{count}} fields left to fill in',
			done: 'Everything is filled in',
			required: 'Required',
			recommended: 'Recommended',
			additional: 'Additional'
		},
		validation: {
			titleRequired: 'A title needs a name'
		},
		ai: {
			action: 'Fill with Claude',
			regenerate: 'Regenerate',
			working: 'Asking Claude…',
			recognized: 'Claude filled in what it knows',
			unrecognized: 'Claude does not recognise this title — only your own words were kept',
			failed: 'Could not reach Claude',
			needsKey: 'Add your Anthropic key in Settings to use this',
			openSettings: 'Open Claude settings',
			filledBadge: 'Claude'
		},
		assistant: {
			title: 'Claude assistant',
			description:
				'Fill the form automatically. Claude picks metadata, genres, a description and more, from the title and its kind.',
			checklistBasics: 'Fills in the basic fields',
			checklistGenres: 'Picks genres and writes a description',
			checklistCover: 'Suggests posters to pick from',
			needsKey: 'Add your Claude key to use this',
			settings: 'Claude settings'
		},
		cover: {
			title: 'Poster',
			hint: 'Picked before the title is even saved — changed any time after, too.',
			tabSearch: 'Search',
			tabUrl: 'URL',
			tabUpload: 'Upload',
			search: 'Search for a poster',
			searchPlaceholder: 'Search by title, year or keywords…',
			searching: 'Looking for pictures…',
			empty: 'No pictures found',
			failed: 'Could not search for a poster',
			pasteUrl: 'Paste a URL',
			urlPlaceholder: 'https://…',
			useUrl: 'Use this address',
			upload: 'Upload a file',
			chooseFile: 'Choose a file',
			remove: 'Remove poster',
			invalidFile: 'That file is not a picture',
			tooLarge: 'That picture is too large',
			current: 'Current poster',
			fromSearch: 'Picked from search',
			fromUrl: 'Pasted address',
			add: 'Add a poster',
			addHint: 'or pick one below'
		},
		delete: {
			action: 'Delete title',
			title: 'Delete {{title}}?',
			hint: 'Library files matched to it stay where they are and can be matched again.',
			confirm: 'Delete',
			failed: 'Could not delete the title'
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
		addManually: 'Add it manually',
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
			dorama: 'Doramas',
			book: 'Books'
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
		failed: 'There were problems transcoding this video. Choose another player to keep watching.',
		loadFailed: 'Could not read this file.',
		needsTranscode: 'This file uses codecs the built-in player cannot decode yet. It plays in mpv.',
		openExternally: 'Open in mpv',
		openDependencies: 'Open Dependencies'
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
		chapterNumber: 'Chapter {{number}}',
		book: {
			read: 'Read',
			loadFailed: 'Could not open this book.',
			unreadable: 'This book could not be laid out. The file may be damaged or protected.',
			contents: 'Contents',
			chapters: 'Chapters',
			contentsProgress_one: '{{current}} of {{count}} chapter',
			contentsProgress_few: '{{current}} of {{count}} chapters',
			contentsProgress_many: '{{current}} of {{count}} chapters',
			contentsProgress_other: '{{current}} of {{count}} chapters',
			contentsTotal_one: '{{count}} chapter',
			contentsTotal_few: '{{count}} chapters',
			contentsTotal_many: '{{count}} chapters',
			contentsTotal_other: '{{count}} chapters',
			smaller: 'Smaller text',
			larger: 'Larger text',
			theme: {
				dark: 'Dark pages',
				sepia: 'Sepia pages',
				light: 'White pages'
			},
			previousPage: 'Previous page',
			nextPage: 'Next page',
			position: 'Position in the book',
			percent: '{{percent}}%'
		}
	},
	playback: {
		episode: 'Episode {{number}}',
		watched: 'Counted as watched',
		pause: 'Pause',
		resume: 'Resume',
		stop: 'Close the player',
		failed: 'Could not start the player'
	},

	discover: {
		open: 'Details',
		featured: 'Featured titles',
		rowFailed: 'This row could not be loaded.',
		tmdbNeeded: 'Movies, series and doramas need a TMDB key',
		sections: {
			trending: 'Trending now',
			thisSeason: 'Top of the season',
			lastSeason: 'Best of last season',
			upcoming: 'Coming soon',
			movies: 'Trending movies',
			manga: 'Trending manga',
			manhwa: 'Trending manhwa',
			manhua: 'Trending manhua',
			popular: 'Popular',
			newest: 'New releases',
			topRated: 'Top rated',
			fantasy: 'Fantasy',
			scienceFiction: 'Science fiction',
			mystery: 'Mystery'
		}
	},

	placeholder: {
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
			heading: 'Chapters',
			subtitle: 'Chapters from all available sources',
			linkedSeries: '{{series}} from {{name}}',
			links: 'Linked series',
			relinkFrom: 'Change series on {{name}}',
			unlinkFrom: 'Unlink {{name}}',
			search: 'Find a chapter by number or title',
			nothingFound: 'No chapters match the filters',
			noChapters: {
				title: 'No chapters yet',
				description: 'Link a source to find chapters for this title.'
			},
			select: 'Select {{label}}',
			selectPage: 'Select the chapters on this page',
			selected: '{{picked}} of {{total}} selected',
			saveSelected: 'Save selected',
			open: 'Open {{label}}',
			markRead: 'Mark {{label}} as read',
			markUnread: 'Mark {{label}} as unread',
			status: {
				label: 'Status',
				all: 'All',
				saved: 'Saved',
				read: 'Read',
				unread: 'Unread',
				online: 'Online'
			},
			sort: {
				newest: 'Newest first',
				oldest: 'Oldest first'
			},
			columns: {
				chapter: 'Chapter',
				source: 'Source',
				language: 'Language',
				pages: 'Pages',
				status: 'Status',
				actions: 'Actions'
			},
			external: 'On the publisher’s site',
			library: 'Library',
			all: 'All sources',
			filter: 'Source',
			copies: 'Other copies',
			link: 'Find a source',
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
			sourceLabel: 'Source',
			sourceDescription: 'Which server to search for the series on',
			searchLabel: 'Series name',
			searchDescription: 'The name to search for, if different from the title',
			search: 'Search',
			noResults: 'Nothing found on this server',
			choose: 'Use',
			failed: 'Could not link the series'
		}
	},
	bookSources: {
		copies: {
			title: 'Free copies',
			subtitle: 'Public-domain books from Project Gutenberg and books on your own OPDS servers',
			searching: 'Looking in your sources…',
			none: 'None of your sources has this book',
			noneHint:
				'Project Gutenberg holds only books in the public domain, mostly older ones in English. A newer book is usually not there.',
			sourceFailed: '{{name}}: {{error}}',
			queued: 'The book is queued',
			failedToQueue: 'Could not queue the book',
			chooseFolder: 'Choose a folder',
			saving: 'Saving {{percent}}%',
			retry: 'Retry {{format}}'
		},
		downloads: {
			empty: 'No books saved yet',
			actionFailed: 'Could not change the download',
			cancel: 'Stop',
			retry: 'Try again',
			forget: 'Remove from the list',
			folderTitle: 'Where to save books',
			folderDescription:
				'Books are saved into a library folder of books, so they are in the library at once',
			noFolders: 'Add a library folder for books in the settings first',
			folderPlaceholder: 'Choose a folder',
			states: {
				queued: 'Waiting',
				running: 'Saving',
				done: 'Saved',
				failed: 'Failed',
				cancelled: 'Stopped'
			}
		},
		gutenberg: {
			enable: 'Search Project Gutenberg',
			note: 'Turning it on downloads Gutenberg’s catalogue, about 6 MB, and searches it on this computer; the site is asked only for a book you save. Almost all of it is in English, and there are no books in Ukrainian.',
			unavailable: 'Project Gutenberg is turned off on this node',
			saveFailed: 'Could not change Project Gutenberg',
			syncing: 'Downloading the catalogue…',
			books_one: '{{number}} book · catalogue of {{date}}',
			books_few: '{{number}} books · catalogue of {{date}}',
			books_many: '{{number}} books · catalogue of {{date}}',
			books_other: '{{number}} books · catalogue of {{date}}',
			noCatalog: 'The catalogue is not downloaded yet',
			refresh: 'Check for updates'
		},
		servers: {
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
					'Address of the catalogue’s root feed, such as http://nas:8083/opds for Calibre-Web',
				standardTitle: 'Standard Ebooks',
				standardHint:
					'Its OPDS feed is open to members of the Patrons Circle: the user name is your e-mail, the password stays empty.',
				standardLink: 'About the feeds',
				standardFill: 'Fill in for Standard Ebooks',
				standardUsername: 'The e-mail of your Patrons Circle membership',
				nameLabel: 'Name',
				namePlaceholder: 'Calibre-Web at home',
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
					no_search: 'The catalogue cannot be searched, so it takes no part in finding books',
					unreachable: 'The server could not be reached',
					other_host: 'The catalogue points to another server'
				}
			}
		}
	},
	torrents: {
		section: {
			hint: 'Search for releases, add your own, and get new episodes by themselves'
		},
		setup: {
			openSettings: 'Open settings',
			noClient: 'No torrent client',
			noClientHint:
				'Choose the built-in client, connect qBittorrent or add a TorBox key in the settings.',
			unreachable: 'The torrent client does not answer',
			noSources: 'No search source',
			noSourcesHint:
				'Add Jackett or Prowlarr in the settings, or install a search plugin on the Extensions page, to search for releases.'
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
			seasonEpisode: 'Season {{season}} · Episode {{number}}',
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
			watchDrawerTitle: 'Pick a release to watch',
			placeholder: 'Search by the title’s names, or type your own query',
			episode: 'Episode',
			submit: 'Search',
			best: 'Best',
			cached: 'Cached in {{service}}',
			bestIs: 'Best match: {{title}}',
			downloadBest: 'Download best',
			queries: 'Searched for: {{queries}}',
			noSources:
				'Add Jackett or Prowlarr in the settings, or install a search plugin on the Extensions page, to search for releases.',
			failed: 'The search failed',
			sourceFailed: '{{name}} did not answer: {{error}}',
			empty: 'Nothing found',
			download: 'Download',
			added: 'Added to the downloads',
			page: 'Open the release page',
			episodes: 'Ep. {{from}}–{{to}}',
			season: 'Season',
			seasonNumber: 'Season {{number}}',
			wholeSeason: 'Season {{number}}, complete',
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
			preferCached: 'Prefer releases {{service}} already holds: they arrive at once',
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
			remove: 'Remove rule',
			fromHint: 'Earlier episodes are ignored.',
			queryHint: 'Searched for instead of the title’s names. Leave empty to use them.',
			saved: 'All changes saved',
			unsaved: 'Unsaved changes',
			stats: {
				lastCheck: 'Last check',
				never: 'Not yet',
				startsFrom: 'Starts from',
				episode: 'Episode {{episode}}',
				lastAdded: 'Added last time',
				downloads_one: '{{count}} download',
				downloads_few: '{{count}} downloads',
				downloads_many: '{{count}} downloads',
				downloads_other: '{{count}} downloads'
			},
			status: {
				paused: 'Paused',
				pausedHint: 'Turn it on to look for new episodes every 30 minutes. Check now still works.',
				failed: 'The last check failed',
				pending: 'Not checked yet',
				pendingHint: 'The first check runs within 30 minutes, or check now to look at once.',
				added_one: 'Added {{count}} download on the last check',
				added_few: 'Added {{count}} downloads on the last check',
				added_many: 'Added {{count}} downloads on the last check',
				added_other: 'Added {{count}} downloads on the last check',
				addedHint: 'They are in the downloads below.',
				caughtUp: 'You’re all caught up',
				caughtUpHint: 'Nothing new on the last check. Mediary keeps looking every 30 minutes.'
			},
			hint: 'Every 30 minutes Mediary searches your sources and adds the best release of each episode the library is missing, taking from a batch only the episodes that are missing.',
			from: 'From episode',
			fromShort: 'from episode {{episode}}',
			query: 'Search for',
			queryPlaceholder: 'The title’s names',
			save: 'Save changes',
			preview: 'Preview matches',
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
			emptyForTitleHint:
				'Search for a release, drop a .torrent file here, or paste a magnet link below.',
			emptyHint: 'Search for a release on a title’s Torrents tab.',
			inLibrary: 'In library: {{count}}',
			active: 'Active: {{count}}',
			title: 'Torrents',
			forTitle: 'Downloads for this title',
			empty: 'No torrent downloads yet',
			emptyForTitle: 'Nothing downloaded for this title yet',
			quickAdd: 'Add',
			dropHint: 'Supports magnet links and .torrent files'
		},
		states: {
			choosing: 'Waiting for your choice of files',
			downloading: 'Downloading',
			paused: 'Paused',
			stalled: 'Looking for peers',
			queued: 'Queued in the client',
			remote: '{{service}} is downloading it',
			remoteQueued: 'Waiting for a free {{service}} slot',
			checking: 'Checking files',
			metadata: 'Fetching the torrent’s metadata',
			error: 'The client reports an error',
			importing: 'Adding to the library',
			done: 'In Library',
			failed: 'Failed',
			unknown: 'Waiting for the client'
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
		stream: {
			watch: 'Watch now, without downloading',
			cancel: 'Stop getting it ready',
			pickEpisode: 'A batch: type the episode in the search to watch it',
			starting: 'Getting it ready…',
			preparing: '{{service}} is getting it · {{percent}}%',
			builtIn: 'The built-in client',
			searching: 'Looking for the best releases…',
			metadata: 'Downloading metadata…',
			buffering: 'Buffering the start · {{percent}}%',
			queued: 'Waiting for a free {{service}} slot',
			failed: 'Could not play it without downloading',
			failedTitle: 'Could not start the video',
			close: 'Close',
			stop: 'Stop',
			collapse: 'Hide details',
			expand: 'Show details',
			candidates: 'Top candidates',
			candidate: {
				trying: 'Analyzing',
				waiting: 'Waiting',
				failed: 'Failed'
			},
			score: 'Score: {{score}}',
			speed: 'Speed:',
			seeders: 'Seeders:',
			complete: '{{percent}}% complete',
			upload: 'Upload: {{speed}}'
		},
		client: {
			notConfigured: 'Choose a torrent client in the settings to download torrents',
			unreachable: 'The torrent client is not answering: {{error}}',
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
			debrid: 'Through debrid',
			debridHint:
				'Downloads go through {{service}}: it gets the torrent on its servers, then Mediary fetches the files over HTTPS. No BitTorrent traffic leaves this computer.',
			debridMissing: 'Set up a debrid service first, in Settings → Debrid service.',
			throughService: 'Through {{service}}',
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
			okAccount: 'Connected: {{account}}',
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
		subtitle: 'Torrents, the rules that add them by themselves, saved manga chapters and free books',
		tabs: {
			torrents: 'Torrents',
			auto: 'Auto-download',
			manga: 'Manga chapters',
			books: 'Free books'
		}
	},
	extensions: {
		refresh: 'Refresh',
		refreshed: 'Refreshed',
		notFound: 'Nothing found matching your criteria.',
		subtitle: 'Manage your media sources and integrations',
		installed: {
			tab: 'Installed',
			tabWithUpdates: 'Installed · {{count}} to update',
			section: 'Installed extensions',
			search: 'Search installed extensions…',
			browseCatalog: 'Browse catalog'
		},
		catalog: {
			tab: 'Catalog',
			section: 'Available extensions'
		},
		filters: {
			allLanguages: 'All languages',
			search: 'Search extensions…'
		},
		dependencies: {
			tab: 'Dependencies',
			kinds: {
				all: 'All types',
				player: 'Player',
				media: 'Video processing'
			},
			statuses: {
				all: 'Any status',
				ready: 'Available',
				missing: 'Not installed'
			},
			search: 'Search programs…'
		}
	},
	plugins: {
		types: {
			all: 'All types',
			'torrent-provider': 'Torrent search',
			'manga-provider': 'Manga sources'
		},
		addByUrl: 'Add by address',
		checkUpdates: 'Check for updates',
		noUpdates: 'Every plugin is up to date',
		updatesFound: 'Updates found: {{count}}',
		emptyInstalled: {
			title: 'No extensions installed',
			description:
				'Install a trusted source from the catalog or add one by its address to start discovering media.'
		},
		emptyCatalog: {
			title: 'The catalog is empty',
			description: 'Mediary has no repository of its own and recommends none. Add one you trust.'
		},
		hosts: 'Reaches {{hosts}}',
		noHosts: 'Reaches no sites',
		multiLanguage: 'Many languages',
		from: 'from {{repository}}',
		disabled: 'Turned off',
		updateCheckFailed: 'Could not check for updates',
		installedHere: 'Installed',
		installedElsewhere: 'Installed from another address',
		install: 'Install',
		update: 'Update to {{version}}',
		settings: 'Settings',
		more: 'More',
		enable: 'Turn on',
		disable: 'Turn off',
		remove: 'Remove',
		removeConfirm: {
			title: 'Remove {{name}}?',
			description:
				'Its code, settings and saved keys go with it. Releases it found stay where they were added.',
			confirm: 'Remove'
		},
		installed: '{{name}} is installed',
		updated: '{{name}} is updated to {{version}}',
		actionFailed: 'Could not do that',
		dialog: {
			installTitle: 'Install plugin',
			updateTitle: 'Update {{name}}',
			urlLabel: 'Manifest address',
			urlHint:
				"The plugin's manifest.json, at an https:// address. Nothing is installed until you agree to what it shows.",
			next: 'Continue',
			reading: 'Reading the manifest…',
			readFailed: 'Could not read the plugin',
			installFailed: 'Could not install the plugin',
			retry: 'Try again',
			hosts_one: 'Reaches {{count}} site',
			hosts_few: 'Reaches {{count}} sites',
			hosts_many: 'Reaches {{count}} sites',
			hosts_other: 'Reaches {{count}} sites',
			hostsNone: 'Reaches no sites',
			hostsNoneHint: 'It cannot make a single request.',
			hostsNew: 'new',
			receivesTitle: 'Receives title info only',
			receives: 'Names, season and episode, and the AniList or TMDB id.',
			receivesManga: 'What you search for, the AniList id, and the series and chapters you open.',
			receivesPrivate: 'Nothing from your accounts',
			settings_one: 'Asks for {{count}} setting',
			settings_few: 'Asks for {{count}} settings',
			settings_many: 'Asks for {{count}} settings',
			settings_other: 'Asks for {{count}} settings',
			secret: 'secret',
			sandboxTitle: 'Runs in a sandbox',
			sandboxFiles: 'No file access',
			sandboxSites: 'No other sites',
			sandboxPrograms: "Can't run programs",
			sandboxNetwork: 'No local network',
			sandboxNote: 'It only finds releases — Mediary does the downloading.',
			sandboxNoteManga:
				'It lists chapters and names their pages — Mediary fetches the images from the sites above and shows them in the reader.',
			source: 'Manifest',
			copy: 'Copy address',
			copied: 'Address copied',
			incompatible: 'It needs Mediary {{version}} or newer.',
			alreadyInstalled: 'Version {{version}} is installed. Update it from the list instead.',
			install: 'Install',
			update: 'Update',
			cancel: 'Cancel'
		},
		settingsDrawer: {
			title: '{{name}} settings',
			description: 'Secret values are kept apart from the rest and never shown again.',
			default: 'Default ({{value}})',
			secretSet: 'Saved. Type a new one to replace it.',
			secretClear: 'Remove',
			save: 'Save',
			saved: 'Settings saved'
		},
		repositories: {
			title: 'Repositories',
			description:
				'Lists of plugins someone publishes. Mediary does not know who stands behind one — add only repositories you trust.',
			urlLabel: 'Repository address',
			add: 'Add repository',
			added: '{{name}} added',
			none: 'No repositories yet.',
			count: 'Plugins: {{count}}',
			skipped: 'left out: {{count}}',
			remove: 'Remove repository'
		}
	},
	tools: {
		purpose: {
			mpv: 'Plays files in its own window',
			ffmpeg: 'Transcodes what the built-in player cannot play, cuts episode stills and pulls out subtitles'
		},
		state: {
			missing: 'Not installed',
			system: 'Found on PATH',
			installed: 'Installed',
			custom: 'Set by hand',
			installing: 'Installing'
		},
		stage: {
			downloading: 'Downloading',
			verifying: 'Checking the checksum',
			extracting: 'Unpacking',
			checking: 'Checking that it runs'
		},
		install: 'Install',
		installSize: 'Install · {{size}}',
		update: 'Update to {{version}}',
		remove: 'Remove',
		cancel: 'Cancel',
		customHint: 'The path is set by {{env}}. Mediary uses it and does not install its own.',
		unsupported: 'Mediary cannot install it on this system yet. Install it yourself:',
		unsupportedNoHint: 'Mediary cannot install it on this system yet.',
		failed: 'Could not install',
		actionFailed: 'Could not do that',
		open: 'Open Dependencies',
		more: 'More',
		updateAvailable: 'Update available',
		official: {
			badge: 'Official',
			title: 'Official Mediary dependency',
			description:
				'Recommended by Mediary: an official build at a pinned version, checked against its checksum before it is installed.'
		}
	},
	tmdb: {
		source: {
			user: 'Using your own key.',
			build: 'Using the key this build ships with. You can use your own instead.',
			none: 'No key yet: movies, series and doramas cannot be looked up until you add one.'
		},
		keyPlaceholder: 'API key or read access token',
		save: 'Check and save',
		getKey: 'Get a free key on TMDB',
		useBuiltIn: 'Use the built-in key',
		saved: 'TMDB accepted the key',
		cleared: 'Back to the built-in key',
		saveFailed: 'Could not save the key',
		disabled: 'TMDB is turned off on this node.',
		note: 'The key stays in a file only you can read on this computer — not in backups. This product uses the TMDB API but is not endorsed or certified by TMDB.',
		openSettings: 'Open TMDB settings'
	},
	googleBooks: {
		source: {
			user: 'Using your own key.',
			build: 'Using the key this build ships with. You can use your own instead.',
			none: 'No key yet: books Open Library does not know cannot be found until you add one.'
		},
		keyPlaceholder: 'Google API key',
		save: 'Check and save',
		getKey: 'Turn on the Books API in Google Cloud',
		useBuiltIn: 'Use the built-in key',
		saved: 'Google accepted the key',
		cleared: 'Back to the built-in key',
		saveFailed: 'Could not save the key',
		disabled: 'Google Books is turned off on this node.',
		note: 'Asked only when Open Library finds nothing: Google counts every request against a daily quota. The key stays in a file only you can read on this computer — not in backups.'
	},
	ai: {
		source: {
			user: 'Using your own key.',
			none: "No key yet: titles you add yourself can't be filled in by Claude until you add one."
		},
		keyPlaceholder: 'Anthropic API key',
		save: 'Check and save',
		getKey: 'Get a key on the Anthropic console',
		useBuiltIn: 'Remove the key',
		saved: 'Anthropic accepted the key',
		cleared: 'Key removed',
		saveFailed: 'Could not save the key',
		disabled: 'Claude is turned off on this node.',
		note: 'The key stays in a file only you can read on this computer — not in backups. Every request is paid for by this key’s own account; there is no key the build ships with.',
		model: 'Model'
	},
	brave: {
		source: {
			user: 'Using your own key.',
			none: 'No key yet: only Wikimedia Commons is searched for posters, which rarely has one.'
		},
		keyPlaceholder: 'Brave Search API key',
		save: 'Check and save',
		getKey: 'Get a free key on Brave Search',
		useBuiltIn: 'Remove the key',
		saved: 'Brave accepted the key',
		cleared: 'Key removed',
		saveFailed: 'Could not save the key',
		disabled: 'Poster search is turned off on this node.',
		note: 'The key stays in a file only you can read on this computer — not in backups.'
	},
	backup: {
		signedOut:
			'Backups go to your Mediary account. Sign in to turn them on — everything else works without an account.',
		signIn: 'Sign in',
		unverified: 'Confirm your email address to turn backups on.',
		verify: 'Confirm email',
		off: 'Signed in as {{name}}. Backups are off on this computer.',
		turnOn: 'Turn on backups',
		paired: 'Backups are on for this computer',
		pairFailed: 'Could not turn backups on',
		lastBackup: 'Last backup {{when}}',
		noBackupYet: 'No backup yet: the first one goes out within a few minutes.',
		backUpNow: 'Back up now',
		backedUp: 'Backed up',
		unchanged: 'Nothing has changed since the last backup',
		backUpFailed: 'Could not back up',
		turnOff: 'Turn off on this computer',
		empty: 'No backups in your account yet.',
		listFailed: 'Could not load the backups.',
		thisDevice: '{{name}} (this computer)',
		restore: 'Restore',
		delete: 'Delete backup',
		deleteFailed: 'Could not delete the backup',
		restoreTitle: 'Restore this backup?',
		restoreHint:
			'Your local tracker and lists will be replaced by the backup from {{device}}, made {{when}}. A copy of the current state is kept in the data folder.',
		restored: 'Backup restored',
		restoreFailed: 'Could not restore the backup',
		note: 'A backup holds your movie, series and book tracker and your own lists — no titles or posters, and nothing from AniList: anime and manga live in your AniList account.',
		banner: {
			outdated:
				'This version of Mediary can no longer back up — everything else works. Update to turn backups back on.',
			update: 'Update'
		}
	},
	devices: {
		signedOut: 'Sign in to your Mediary account to see the computers paired with it.',
		listFailed: 'Could not load the devices.',
		empty: 'No computers are paired with your account yet.',
		thisDevice: '{{name}} (this computer)',
		lastSeen: 'Active {{when}}',
		revoke: 'Revoke',
		revokeFailed: 'Could not revoke the device',
		note: 'A revoked computer stops backing up at once. Its backups stay in your account.'
	},
	settings: {
		sections: {
			app: {
				title: 'App',
				subtitle: 'Appearance, language and first-time setup'
			},
			anilist: {
				title: 'AniList',
				subtitle: 'The account your anime and manga lists live in'
			},
			backup: {
				title: 'Backup',
				subtitle: 'Your lists in your Mediary account'
			},
			devices: {
				title: 'Devices',
				subtitle: 'Computers paired with your account'
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
			debrid: {
				title: 'Debrid service',
				subtitle: 'Watch without downloading'
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
				subtitle: 'OPDS catalogs with manga'
			},
			tmdb: {
				title: 'TMDB',
				subtitle: 'Movies, series and doramas'
			},
			googleBooks: {
				title: 'Google Books',
				subtitle: 'Books Open Library does not know'
			},
			manualMedia: {
				title: 'Titles you add yourself',
				subtitle: 'Claude filling in details, and posters'
			},
			mangaDownloads: {
				title: 'Manga downloads',
				subtitle: 'Where downloaded chapters are kept'
			},
			bookSources: {
				title: 'Book sources',
				subtitle: 'Project Gutenberg and your OPDS catalogues of books'
			},
			bookDownloads: {
				title: 'Book downloads',
				subtitle: 'Where saved books are kept'
			}
		},
		tmdb: {
			name: 'TMDB key',
			hint: 'Where movies, series and doramas are looked up'
		},
		googleBooks: {
			name: 'Google Books key',
			hint: 'Where books Open Library does not know are looked up'
		},
		ai: {
			name: 'Claude key',
			hint: 'Fills in a title you add yourself, with your own Anthropic key'
		},
		brave: {
			name: 'Brave Search key',
			hint: 'Finds posters for titles you add yourself'
		},
		mangaDownloads: {
			name: 'Manga downloads',
			hint: 'Library folder chapters are saved to, as CBZ files'
		},
		gutenberg: {
			name: 'Project Gutenberg',
			hint: 'Over 75,000 public-domain books, searched on this computer'
		},
		bookServers: {
			name: 'OPDS servers',
			hint: 'Your own catalogues of books — Calibre-Web, Kavita — and Standard Ebooks for its patrons'
		},
		bookDownloads: {
			name: 'Book downloads',
			hint: 'Library folder of books that saved copies go to'
		},
		torrents: {
			name: 'Torrents',
			hint: 'The client that downloads torrents into your library'
		},
		debrid: {
			name: 'Debrid service',
			hint: 'Your own TorBox, Real-Debrid, AllDebrid or Premiumize account. It lets you watch a release at once, without downloading it, whatever client fills the library'
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
		anilist: {
			name: 'AniList account',
			hint: 'Connect it to see and update your anime and manga lists'
		},
		backup: {
			name: 'Backups',
			hint: 'Move your tracker and lists to another computer'
		},
		devices: {
			name: 'Paired computers',
			hint: 'Nodes allowed to back up to your account'
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
			},
			mpvMissing: {
				title: 'mpv is not installed',
				description:
					'Episodes will not open until it is. Install it in one click, or switch to the built-in player.'
			}
		},
		wizard: {
			name: 'Setup wizard',
			hint: 'Re-run first-time setup: folders, player, downloads',
			action: 'Open wizard'
		},
		node: {
			name: 'Node',
			hint: 'Version and build of the local node'
		}
	},
	pagination: {
		label: 'Pages',
		previous: 'Previous page',
		next: 'Next page',
		page: 'Page {{page}}'
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

	debrid: {
		notConfigured: 'Not connected',
		readySubtitle: 'Watch now is on in torrent search',
		offSubtitle: 'Connect one to watch releases without downloading them',
		configure: 'Connect',
		edit: 'Change',
		drawerTitle: 'Debrid service',
		drawerDescription: 'A service that holds torrents on its servers and plays them to you at once.',
		serviceLabel: 'Service',
		serviceHint: 'Real-Debrid, AllDebrid and Premiumize work only with a premium account.',
		torboxFree: 'TorBox has a free plan: one torrent at a time, a few a month.',
		apiKeyLabel: 'API key',
		apiKeyHint: 'Copy it from {{page}}. The node keeps it in a file of its own and never shows it again',
		apiKeyKept: 'Leave empty to keep the saved key',
		check: 'Check the key',
		ok: 'Connected: {{account}}',
		checkFailed: 'The service did not accept the key',
		save: 'Save',
		saveFailed: 'Could not save the debrid service',
		offLabel: 'Turn off',
		offHint: 'Watch now goes away; the key stays saved for later.',
		offInUse: 'The torrent client downloads through it: choose another client first.',
		turnOff: 'Turn off'
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
				description:
					'Choose how Mediary downloads torrents: its built-in client, your own qBittorrent, or a debrid service'
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
			}
		},
		account: {
			blurb: 'A Mediary account is optional: it only backs up your lists and settings so you can move to another device',
			signIn: 'Sign in',
			or: 'or',
			signUp: 'Create an account'
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
		empty: 'Nothing on your lists yet. Find something in Discover or Search and add it',
		banner: {
			label: 'Anime in progress',
			open: 'Details',
			progress: 'Watched',
			continue: 'Continue · {{episode}}'
		},
		continue: {
			title: 'Continue watching'
		},
		rows: {
			current: 'In progress',
			planning: 'Planning',
			completed: 'Recently completed'
		},
		stats: {
			title: 'Statistics',
			titles: 'Titles on lists',
			episodes: 'Episodes watched',
			chapters: 'Chapters read',
			meanScore: 'Average score',
			topGenres: 'Favourite genres',
			topGenresNote: 'Most common on your lists',
			completedThisMonth_one: '+{{count}} completed this month',
			completedThisMonth_few: '+{{count}} completed this month',
			completedThisMonth_many: '+{{count}} completed this month',
			completedThisMonth_other: '+{{count}} completed this month',
			typesNote_one: 'in {{count}} media type',
			typesNote_few: 'across {{count}} media types',
			typesNote_many: 'across {{count}} media types',
			typesNote_other: 'across {{count}} media types',
			acrossNote_one: 'in {{count}} title',
			acrossNote_few: 'across {{count}} titles',
			acrossNote_many: 'across {{count}} titles',
			acrossNote_other: 'across {{count}} titles',
			scoredNote_one: 'from {{count}} scored title',
			scoredNote_few: 'from {{count}} scored titles',
			scoredNote_many: 'from {{count}} scored titles',
			scoredNote_other: 'from {{count}} scored titles',
			activity: {
				title: 'Activity',
				subtitle: 'Titles started and completed',
				started: 'Started',
				completed: 'Completed',
				empty: 'No start or finish dates on your lists yet',
				range: {
					'6m': '6 months',
					'1y': 'Year',
					all: 'All time'
				}
			},
			genres: {
				title: 'Genres',
				subtitle: 'What you watch and read',
				other: 'Other',
				empty: 'Start something and its genres will show here',
				center_one: 'genre',
				center_few: 'genres',
				center_many: 'genres',
				center_other: 'genres'
			},
			scores: {
				title: 'Your scores',
				subtitle_one: '{{count}} scored title',
				subtitle_few: '{{count}} scored titles',
				subtitle_many: '{{count}} scored titles',
				subtitle_other: '{{count}} scored titles',
				mean: 'average',
				bucket: 'Score {{score}}',
				titles: 'Titles',
				empty: 'Score a title and the spread will show here'
			},
			topRated: {
				title: 'Your top 5',
				subtitle: 'By your own scores',
				empty: 'Nothing scored yet'
			},
			byType: {
				title: 'By media type',
				subtitle: 'How each kind splits by status',
				total: 'Total',
				all: 'All'
			},
			status: {
				CURRENT: 'In progress',
				PLANNING: 'Planning',
				COMPLETED: 'Completed',
				PAUSED: 'Paused',
				DROPPED: 'Dropped',
				REPEATING: 'Repeating'
			}
		}
	}
} as const
