export type AuthMode = 'signIn' | 'signUp'

export const AUTH_MODES = {
	signIn: {
		eyebrow: 'auth.signIn.eyebrow',
		title: 'auth.signIn.title',
		subtitle: 'auth.signIn.subtitle',
		emailTitle: 'auth.signIn.emailTitle',
		emailSubtitle: 'auth.signIn.emailSubtitle',
		providersRoute: '/sign-in',
		emailRoute: '/sign-in/email',
		otherRoute: '/sign-up',
		otherEmailRoute: '/sign-up/email'
	},
	signUp: {
		eyebrow: 'auth.signUp.eyebrow',
		title: 'auth.signUp.title',
		subtitle: 'auth.signUp.subtitle',
		emailTitle: 'auth.signUp.emailTitle',
		emailSubtitle: 'auth.signUp.emailSubtitle',
		providersRoute: '/sign-up',
		emailRoute: '/sign-up/email',
		otherRoute: '/sign-in',
		otherEmailRoute: '/sign-in/email'
	}
} as const
