import type { Translation } from './en'

export const uk: Translation = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
	},

	node: {
		state: {
			stopped: 'Ноду зупинено',
			starting: 'Нода запускається…',
			ready: 'Ноду підключено',
			restarting: 'Нода перезапускається…',
			failed: 'Нода не запустилася'
		}
	},

	input: {
		showPassword: 'Показати пароль',
		hidePassword: 'Сховати пароль'
	},

	auth: {
		pitch: {
			titleLead: 'Твоя',
			titleAccent: 'медіатека',
			tagline:
				'Аніме, манга, дорами, фільми, серіали й книги — один каталог, один прогрес, на всіх пристроях.',
			aside: 'Акаунт потрібен лише для хмарного каталогу й синхронізації. Локальна бібліотека, плеєр і завантаження працюють і без нього.'
		},
		back: 'Повернутися назад',
		or: 'або',
		otherWay: 'Інший спосіб входу',
		providers: {
			label: 'Продовжити через',
			lastUsed: 'Минулого разу',
			failed: 'Не вдалося увійти через {{provider}}. Спробуйте ще раз.'
		},
		signIn: {
			eyebrow: 'З поверненням',
			title: 'Вітаємо!',
			subtitle: 'Оберіть, як вам зручніше увійти.',
			emailTitle: 'Вхід',
			emailSubtitle: 'Увійдіть, щоб продовжити з того самого місця.',
			submit: 'Увійти',
			useEmail: 'Увійти через пошту й пароль',
			forgotPassword: 'Забули пароль?',
			noAccount: 'Немає акаунта?',
			switch: 'Зареєструватися'
		},
		signUp: {
			eyebrow: 'Приєднуйтеся',
			title: 'Створити акаунт',
			subtitle: 'Оберіть, як вам зручніше зареєструватися.',
			emailTitle: 'Реєстрація',
			emailSubtitle: 'Кілька полів — і готово.',
			submit: 'Зареєструватися',
			useEmail: 'Зареєструватися через пошту',
			haveAccount: 'Вже маєте акаунт?',
			switch: 'Увійти'
		},
		field: {
			name: 'Імʼя',
			email: 'Email',
			password: 'Пароль',
			passwordHint: 'Пароль, щонайменше {{min}} символів',
			confirmation: 'Повторіть пароль',
			code: 'Код підтвердження'
		},
		verify: {
			eyebrow: 'Майже все',
			title: 'Підтвердіть пошту',
			description: 'Введіть код із {{length}} цифр, який ми надіслали на {{email}}.',
			submit: 'Підтвердити пошту',
			resendLabel: 'Не отримали код?',
			resend: 'Надіслати новий',
			later: 'Підтвердити пізніше'
		},
		reset: {
			eyebrow: 'Відновлення доступу',
			title: 'Скидання пароля',
			description: 'Вкажіть пошту, з якою реєструвалися. Якщо на ній є акаунт, код уже в дорозі.',
			submit: 'Надіслати код',
			backToSignIn: 'Повернутися до входу'
		},
		newPassword: {
			eyebrow: 'Останній крок',
			title: 'Новий пароль',
			description: 'Введіть код, надісланий на {{email}}, і придумайте новий пароль.',
			submit: 'Зберегти пароль',
			requestAnother: 'Надіслати новий код',
			remembered: 'Згадали пароль? Увійти'
		},
		otp: {
			remaining: 'дійсний ще {{time}}',
			expired: 'Код застарів'
		},
		validation: {
			emailRequired: 'Вкажіть email',
			emailTooLong: 'Email не довший за {{max}} символів',
			emailInvalid: 'Email виглядає некоректно',
			nameRequired: 'Вкажіть імʼя',
			nameLength: 'Імʼя від {{min}} до {{max}} символів',
			passwordTooShort: 'Пароль щонайменше {{min}} символів',
			passwordTooLong: 'Пароль не довший за {{max}} символів',
			passwordEchoesIdentity: 'Пароль не має повторювати email або імʼя',
			confirmationRequired: 'Повторіть пароль',
			confirmationMismatch: 'Паролі не збігаються',
			codeRequired: 'Введіть код із листа',
			codeIncomplete: 'Код складається з {{length}} цифр'
		},
		error: {
			cloudUnreachable: 'Не вдалося звʼязатися з хмарою',
			requestFailed: 'Не вдалося виконати запит'
		}
	},

	home: {
		subtitle: 'Скелет фази 0. Каталогу ще немає — тут лише перевірка, що оболонка бачить ноду.',
		account: {
			title: 'Хмарний акаунт',
			anonymous: 'Не увійдено — каталог і синхронізація недоступні.',
			signIn: 'Увійти',
			signOut: 'Вийти'
		},
		node: {
			title: 'Локальна нода',
			waiting: 'Очікування на запуск ноди…',
			pending: 'Запит стану…',
			failed: 'Не вдалося опитати ноду: {{error}}',
			version: 'Версія',
			build: 'Збірка',
			linkedLabel: 'Хмарний акаунт',
			linked: 'привʼязано',
			notLinked: 'не привʼязано'
		}
	}
}
