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
		or: 'or',
		otherWay: 'Use a different sign-in method',
		providers: {
			label: 'Continue with',
			lastUsed: 'Last used',
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
			resend: 'Send a new one',
			later: 'Verify later'
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
			passwordTooShort: 'Password must be at least {{min}} characters',
			passwordTooLong: 'Password must be at most {{max}} characters',
			passwordEchoesIdentity: 'The password must not repeat your email or name',
			confirmationRequired: 'Repeat the password',
			confirmationMismatch: 'The passwords do not match',
			codeRequired: 'Enter the code from the email',
			codeIncomplete: 'The code is {{length}} digits long'
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
