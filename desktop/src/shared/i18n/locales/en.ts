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

	nav: {
		label: 'Main navigation',
		home: 'Home',
		discover: 'Discover',
		catalog: 'Catalog',
		lists: 'My lists',
		library: 'Library',
		downloads: 'Downloads',
		settings: 'Settings',
		signIn: 'Sign in'
	},

	anilist: {
		connect: {
			title: 'AniList',
			description:
				'Anime and manga live in your AniList account. Mediary reads and updates them from this computer.',
			open: 'Get a token on AniList',
			tokenLabel: 'Access token',
			tokenPlaceholder: 'Paste the token from AniList',
			tokenHint:
				'AniList opens in your browser. Approve access, copy the token it shows and paste it here.',
			submit: 'Connect',
			notConfigured: 'This build has no AniList client configured, so sign-in is unavailable.',
			connectedAs: 'Connected as {{name}}',
			disconnect: 'Disconnect',
			failure: {
				rejected: 'AniList did not accept this token. Copy it again and retry.',
				unreachable: 'AniList is unreachable right now. Check your connection and retry.',
				unknown: 'Could not connect the account. Try again.'
			}
		}
	},

	lists: {
		tabs: {
			anime: 'Anime',
			manga: 'Manga'
		},
		loading: 'Loading your list…',
		stale: 'Showing saved data while AniList updates',
		failed: 'Could not load the list.',
		retry: 'Retry',
		empty: 'Nothing here yet.',
		connect: 'Connect AniList to see your lists',
		source: 'Data from {{name}}',
		episodes: 'Ep. {{progress}}',
		chapters: 'Ch. {{progress}}',
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

	placeholder: {
		discover: 'Recommendations and fresh releases will live here once the cloud catalog is connected.',
		catalog: 'Search across every media type with filters by genre, year and rating.',
		lists: 'Your watch statuses, ratings and personal collections.',
		library: 'Local files scanned by the node and matched against catalog titles.',
		downloads: 'Torrent providers and the download queue handled by the node.'
	},

	settings: {
		appearance: {
			name: 'Appearance',
			hint: 'Light or dark surface for the whole app.'
		},
		language: {
			name: 'Language',
			hint: 'Interface language. Catalog titles keep their own languages.'
		},
		wizard: {
			name: 'Setup wizard',
			hint: 'Re-run first-time setup: folders, player, downloads.',
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
				'Anime, manga, dramas, films, series and books — one catalog, one progress, across every device.',
			aside: 'An account is only needed for the cloud catalog and sync. The local library, player and downloads work without one.'
		},
		back: 'Go back',
		or: 'or',
		otherWay: 'Use a different sign-in method',
		providers: {
			label: 'Continue with',
			lastUsed: 'Last used',
			waiting: 'Waiting for {{provider}} in your browser.',
			cancel: 'Cancel',
			unavailable: 'Could not load sign-in options.',
			reload: 'Try again',
			failed: 'Could not sign in with {{provider}}. Please try again.'
		},
		signIn: {
			eyebrow: 'Welcome back',
			title: 'Hi there!',
			subtitle: 'Choose how you want to sign in.',
			emailTitle: 'Sign in',
			emailSubtitle: 'Sign in to continue where you left off.',
			submit: 'Sign in',
			useEmail: 'Sign in with email and password',
			forgotPassword: 'Forgot password?',
			noAccount: 'No account yet?',
			switch: 'Create one'
		},
		signUp: {
			eyebrow: 'Join us',
			title: 'Create an account',
			subtitle: 'Choose how you want to sign up.',
			emailTitle: 'Sign up',
			emailSubtitle: 'A few fields and you are done.',
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
			description: 'Enter the {{length}}-digit code we sent to {{email}}.',
			submit: 'Verify email',
			resendLabel: 'Did not get the code?',
			resend: 'Send a new one'
		},
		reset: {
			eyebrow: 'Account recovery',
			title: 'Reset password',
			description:
				'Enter the address you registered with. If it has an account, a code is already on its way.',
			submit: 'Send reset code',
			backToSignIn: 'Back to sign in'
		},
		newPassword: {
			eyebrow: 'Almost done',
			title: 'New password',
			description: 'Enter the code sent to {{email}}, then choose a new password.',
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
		pending: 'This step is not built yet.',
		steps: {
			library: {
				label: 'Local library',
				title: 'Local library',
				description:
					'Choose the folders your files already live in. Mediary scans them and matches what it finds against the catalog.'
			},
			player: {
				label: 'Player',
				title: 'External media player',
				description:
					'Choose your preferred player for anime, films and series. Progress is tracked automatically.'
			},
			downloads: {
				label: 'Downloads',
				title: 'Downloading',
				description: 'Configure your torrent client for downloading.'
			},
			anilist: {
				label: 'AniList',
				title: 'Connect AniList',
				description:
					'Anime and manga lists live in your AniList account. Connect it once and Mediary keeps them in sync.'
			},
			account: {
				label: 'Backup',
				title: 'Mediary account',
				description:
					'Optional. A Mediary account only keeps a backup of your lists and settings for your other devices.'
			},
			debrid: {
				label: 'Debrid service',
				title: 'Debrid service',
				description: 'Debrid services offer faster downloads and instant streaming from the cloud.'
			}
		},
		account: {
			blurb: 'A Mediary account is optional: it only backs up your lists and settings so you can move to another device.',
			google: 'Continue with Google',
			or: 'or',
			email: 'Continue with email'
		},
		library: {
			placeholder: 'No folder selected',
			browse: 'Choose a folder',
			video: {
				label: 'Video',
				hint: 'Anime, films and series. Subfolders are scanned too.'
			},
			reading: {
				label: 'Reading',
				hint: 'Manga, manhwa and books.'
			},
			aside: 'You can skip this and add folders later — the catalog works without a local library.'
		},
		player: {
			notice: "Mediary's node comes with a built-in player powered by mpv. You can still configure an external one below.",
			select: {
				label: 'Desktop media player',
				mpv: 'MPV (Recommended)',
				vlc: 'VLC',
				custom: 'Custom command',
				hint: 'MPV is recommended for better subtitle rendering and torrent streaming.'
			},
			install:
				'On Windows, install MPV using Scoop or Chocolatey. On macOS, install MPV using Homebrew.'
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
			description: 'The address is wrong, or the screen has been removed.',
			home: 'Back to home'
		},
		error: {
			title: 'Something went wrong',
			description: 'The screen could not be opened. Try again, or go back to home.',
			retry: 'Try again'
		}
	},
	home: {
		subtitle: 'Phase 0 skeleton. No catalog yet — this only proves the shell can see the node.',
		account: {
			title: 'Cloud account',
			anonymous: 'Not signed in — catalog and sync are unavailable.',
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
