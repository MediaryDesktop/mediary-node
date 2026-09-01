/**
 * The key source of truth.
 *
 * Every other locale is typed as `typeof en`, so a missing or misspelled key in
 * a translation is a compile error rather than a English string leaking into a
 * Ukrainian screen. Adding a key here without translating it breaks the build —
 * which is the point.
 */
type Widen<T> = { [Key in keyof T]: T[Key] extends string ? string : Widen<T[Key]> }

/**
 * The shape every other locale must satisfy: same keys, plain strings.
 *
 * `en` keeps its literal types (`as const`) so i18next can derive both the key
 * union and the interpolation variables inside each phrase; the other locales
 * would fail to match those literals, hence the widening.
 */
export type Translation = Widen<typeof en>

export const en = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
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

	auth: {
		pitch: {
			titleLead: 'Your',
			titleAccent: 'media library',
			tagline:
				'Anime, manga, dramas, films, series and books — one catalog, one progress, across every device.',
			aside: 'An account is only needed for the cloud catalog and sync. The local library, player and downloads work without one.'
		},
		back: 'Go back',
		signIn: {
			title: 'Welcome back',
			subtitle: 'Sign in to continue',
			submit: 'Sign in',
			noAccount: 'No account yet?',
			switch: 'Create one'
		},
		signUp: {
			title: 'Create an account',
			subtitle: 'A few fields and you are done',
			submit: 'Sign up',
			haveAccount: 'Already have an account?',
			switch: 'Sign in'
		},
		field: {
			name: 'Name',
			email: 'Email',
			password: 'Password',
			passwordHint: 'Password, at least {{min}} characters',
			confirmation: 'Repeat the password'
		},
		validation: {
			emailRequired: 'Enter your email',
			emailTooLong: 'Email must be at most {{max}} characters',
			emailInvalid: 'That email does not look right',
			nameRequired: 'Enter your name',
			nameLength: 'Name must be {{min}} to {{max}} characters',
			passwordTooShort: 'Password must be at least {{min}} characters',
			passwordTooLong: 'Password must be at most {{max}} characters',
			passwordEchoesIdentity: 'The password must not repeat your email or name',
			confirmationRequired: 'Repeat the password',
			confirmationMismatch: 'The passwords do not match'
		},
		error: {
			cloudUnreachable: 'Could not reach the cloud',
			requestFailed: 'The request failed'
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
