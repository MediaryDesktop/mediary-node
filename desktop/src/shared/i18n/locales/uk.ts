import type { Translation } from './en'

export const uk: Translation = {
	language: {
		en: 'English',
		uk: 'Українська',
		ru: 'Русский'
	},

	theme: {
		label: 'Тема',
		dark: 'Темна тема',
		light: 'Світла тема'
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

	nav: {
		label: 'Головна навігація',
		home: 'Головна',
		discover: 'Огляд',
		catalog: 'Каталог',
		lists: 'Мої списки',
		library: 'Бібліотека',
		downloads: 'Завантаження',
		settings: 'Налаштування',
		signIn: 'Увійти'
	},

	placeholder: {
		discover: 'Тут зʼявляться рекомендації та свіжі релізи, щойно буде підключено хмарний каталог.',
		catalog: 'Пошук по всіх типах медіа з фільтрами за жанром, роком і рейтингом.',
		lists: 'Ваші статуси перегляду, оцінки та власні добірки.',
		library: 'Локальні файли, які сканує нода і зіставляє з тайтлами каталогу.',
		downloads: 'Джерела торентів і черга завантажень, якою керує нода.'
	},

	settings: {
		appearance: {
			name: 'Вигляд',
			hint: 'Світла або темна тема для всього застосунку.'
		},
		language: {
			name: 'Мова',
			hint: 'Мова інтерфейсу. Назви в каталозі лишаються своїми мовами.'
		},
		wizard: {
			name: 'Майстер налаштування',
			hint: 'Пройти первинне налаштування ще раз: теки, плеєр, завантаження.',
			action: 'Відкрити майстер'
		}
	},
	select: {
		placeholder: 'Оберіть…',
		noResults: 'Нічого не знайдено',
		clear: 'Очистити вибір',
		remove: 'Прибрати {{label}}'
	},
	window: {
		minimize: 'Згорнути',
		maximize: 'Розгорнути',
		restore: 'Відновити',
		close: 'Закрити'
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
			waiting: 'Очікування {{provider}} у браузері.',
			cancel: 'Скасувати',
			unavailable: 'Не вдалося завантажити способи входу.',
			reload: 'Спробувати ще раз',
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
			resend: 'Надіслати новий'
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
			passwordRequired: 'Введіть пароль',
			passwordTooShort: 'Пароль щонайменше {{min}} символів',
			passwordTooLong: 'Пароль не довший за {{max}} символів',
			passwordLength: 'Пароль від {{min}} до {{max}} символів',
			passwordEchoesIdentity: 'Пароль не має повторювати email або імʼя',
			confirmationRequired: 'Повторіть пароль',
			confirmationMismatch: 'Паролі не збігаються',
			codeRequired: 'Введіть код із листа',
			codeIncomplete: 'Код складається з {{length}} цифр',
			fieldInvalid: 'Перевірте поле «{{field}}»'
		},
		error: {
			cloudUnreachable: 'Не вдалося звʼязатися з хмарою',
			requestFailed: 'Не вдалося виконати запит'
		}
	},

	setup: {
		note: 'Ці налаштування можна змінити пізніше',
		railLabel: 'Кроки налаштування',
		progress: 'Крок {{current}} з {{total}}',
		previous: 'Назад',
		next: 'Далі',
		finish: 'Завершити',
		pending: 'Цей крок ще не зроблено.',
		steps: {
			library: {
				label: 'Локальна бібліотека',
				title: 'Локальна бібліотека',
				description:
					'Оберіть теки, де вже лежать ваші файли. Mediary просканує їх і зіставить знайдене з каталогом.'
			},
			player: {
				label: 'Плеєр',
				title: 'Зовнішній плеєр',
				description:
					'Оберіть, чим відтворювати аніме, фільми й серіали. Прогрес відстежується автоматично.'
			},
			downloads: {
				label: 'Завантаження',
				title: 'Завантаження файлів',
				description: 'Налаштуйте торент-клієнт для завантаження.'
			},
			account: {
				label: 'Хмарний акаунт',
				title: 'Хмарний акаунт',
				description:
					'Привʼяжіть цей компʼютер до акаунта Mediary, щоб прогрес їхав за вами на інші пристрої.'
			},
			debrid: {
				label: 'Debrid-сервіс',
				title: 'Debrid-сервіс',
				description: 'Debrid-сервіси пришвидшують завантаження й дають миттєвий стрімінг із хмари.'
			}
		},
		account: {
			blurb: 'Акаунт потрібен лише для хмарного каталогу й синхронізації. Локальна бібліотека, плеєр і завантаження працюють і без нього.',
			google: 'Продовжити через Google',
			or: 'або',
			email: 'Продовжити через email'
		},
		library: {
			placeholder: 'Теку не обрано',
			browse: 'Обрати теку',
			video: {
				label: 'Відео',
				hint: 'Аніме, фільми й серіали. Вкладені теки теж скануються.'
			},
			reading: {
				label: 'Читання',
				hint: 'Манга, манхва й книги.'
			},
			aside: 'Це можна пропустити й додати теки згодом — каталог працює й без локальної бібліотеки.'
		},
		player: {
			notice: 'Нода Mediary має вбудований плеєр на базі mpv. Нижче все одно можна налаштувати зовнішній.',
			select: {
				label: 'Плеєр для десктопа',
				mpv: 'MPV (Рекомендовано)',
				vlc: 'VLC',
				custom: 'Своя команда',
				hint: 'MPV рекомендовано для кращого рендерингу субтитрів і торент-стримінгу.'
			},
			install: 'У Windows встановіть MPV через Scoop або Chocolatey. У macOS — через Homebrew.'
		},
		downloading: {
			client: {
				title: 'Торент-клієнт',
				description: 'Клієнт для завантаження торентів',
				label: 'Клієнт',
				qbittorrent: 'qBittorrent'
			},
			qbittorrent: {
				title: 'Налаштування qBittorrent',
				host: 'Хост',
				username: 'Імʼя користувача',
				password: 'Пароль',
				port: 'Порт',
				executable: 'Шлях до виконуваного файлу'
			}
		},
		debrid: {
			label: 'Debrid-сервіс',
			none: 'Немає',
			torbox: 'TorBox',
			realDebrid: 'Real-Debrid',
			allDebrid: 'AllDebrid',
			premiumize: 'Premiumize'
		}
	},

	fallback: {
		notFound: {
			title: 'Такого екрана немає',
			description: 'Адреса помилкова, або екран прибрали.',
			home: 'На головну'
		},
		error: {
			title: 'Щось пішло не так',
			description: 'Не вдалося відкрити екран. Спробуйте ще раз або поверніться на головну.',
			retry: 'Спробувати ще раз'
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
