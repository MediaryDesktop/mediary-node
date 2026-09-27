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

	datePicker: {
		previousMonth: 'Попередній місяць',
		nextMonth: 'Наступний місяць',
		previousYear: 'Попередній рік',
		nextYear: 'Наступний рік'
	},

	nav: {
		label: 'Головна навігація',
		home: 'Головна',
		discover: 'Огляд',
		search: 'Пошук',
		lists: 'Мої списки',
		library: 'Бібліотека',
		downloads: 'Завантаження',
		settings: 'Налаштування',
		signIn: 'Увійти'
	},

	anilist: {
		connect: {
			title: 'AniList',
			description:
				'Аніме й манга живуть у вашому акаунті AniList. Mediary читає й оновлює їх із цього компʼютера',
			open: 'Отримати токен на AniList',
			tokenLabel: 'Токен доступу',
			tokenPlaceholder: 'Вставте токен з AniList',
			tokenHint:
				'AniList відкриється в браузері. Дозвольте доступ, скопіюйте показаний токен і вставте його сюди',
			submit: 'Підключити',
			notConfigured: 'У цій збірці не налаштовано клієнт AniList, тож вхід недоступний',
			connectedAs: 'Підключено як {{name}}',
			disconnect: 'Відключити',
			failure: {
				rejected: 'AniList не прийняв цей токен. Скопіюйте його ще раз і повторіть',
				unreachable: 'AniList зараз недоступний. Перевірте зʼєднання й повторіть',
				unknown: 'Не вдалося підключити акаунт. Спробуйте ще раз'
			}
		}
	},

	common: {
		cancel: 'Скасувати'
	},

	lists: {
		listCount_one: '{{count}} список',
		listCount_few: '{{count}} списки',
		listCount_many: '{{count}} списків',
		listCount_other: '{{count}} списку',
		titleCount_one: '{{count}} тайтл',
		titleCount_few: '{{count}} тайтли',
		titleCount_many: '{{count}} тайтлів',
		titleCount_other: '{{count}} тайтла',
		pinned: 'Закріплені',
		yours: 'Ваші списки',
		search: 'Пошук списків',
		filterAll: 'Усі',
		seeAll: 'Показати всі',
		noMatches: 'За цим запитом немає списків',
		noLists: 'Списків поки немає',
		filters: {
			search: 'Пошук у цьому списку',
			anyStatus: 'Будь-який статус',
			anyFormat: 'Будь-який формат',
			anyGenre: 'Будь-який жанр',
			noMatches: 'У цьому списку немає тайтлів за такими фільтрами',
			reset: 'Скинути',
			sort: {
				default: 'Порядок списку',
				title: 'За назвою',
				score: 'За вашою оцінкою',
				progress: 'За прогресом',
				updated: 'Нещодавно оновлені'
			}
		},
		mediaType: {
			movie: 'Фільми',
			series: 'Серіали',
			dorama: 'Дорами',
			anime: 'Аніме',
			book: 'Книги',
			manga: 'Манга'
		},
		sort: {
			recent: 'Нещодавно оновлені',
			name: 'За назвою',
			size: 'Найбільші'
		},
		view: {
			grid: 'Сітка',
			rows: 'Список'
		},
		card: {
			empty: 'Порожній',
			updated: 'Оновлено {{when}}',
			overflow: '+{{count}}'
		},
		shortcut: {
			watchlist: 'Заплановане',
			watchlistHint: 'Тайтли, які ви плануєте подивитись або прочитати',
			completed: 'Завершене',
			completedHint: 'Усе, що ви пройшли до кінця',
			current: 'Зараз дивлюсь'
		},
		manage: {
			new: 'Новий список',
			createTitle: 'Створити список',
			createSubtitle: 'Список тримає один тип медіа, тож тайтли лишаються там, де їм місце',
			renameTitle: 'Перейменувати список',
			create: 'Створити список',
			save: 'Зберегти',
			rename: 'Перейменувати',
			delete: 'Видалити',
			deleteTitle: 'Видалити «{{name}}»?',
			deleteHintAniList:
				'Список зникне з вашого акаунта AniList. Тайтли з нього лишаться у ваших списках',
			deleteHintLocal: 'Список зникне з цього компʼютера. Тайтли з нього лишаться у ваших списках',
			options: 'Дії зі списком',
			nameLabel: 'Назва списку',
			nameHint: 'Її можна змінити пізніше',
			namePlaceholder: 'Напр. Подивитись пізніше',
			typeLabel: 'Тип медіа',
			typeHintAniList: 'Списки аніме й манги створюються у вашому акаунті AniList',
			typeHintLocal: 'Цей список зберігається на цьому компʼютері',
			typeLocked: 'Список лишається з тим типом медіа, з яким його створили',
			duplicate: 'Список із такою назвою вже існує',
			notConnected: 'Підключіть AniList, щоб створювати списки аніме й манги',
			offline: 'AniList недоступний, тож зараз цей список не змінити',
			failed: 'Не вдалося зберегти список. Спробуйте ще раз'
		},
		manageEntry: {
			action: 'Керувати списками',
			title: 'Керувати списками',
			save: 'Зберегти зміни',
			statusHint: 'Де цей тайтл у ваших списках AniList',
			lists: 'Списки',
			listsHint: 'Натисніть на список, щоб додати або прибрати тайтл',
			listsEmpty: 'Для цього типу медіа ще немає кастомних списків'
		},
		rateEntry: {
			action: 'Оцінка й нотатки',
			title: 'Оцінка й нотатки',
			scoreHint: 'Оцінка у форматі, який використовує ваш акаунт AniList',
			progressHint: 'Синхронізується з вашим списком AniList',
			repeatHint: 'Скільки разів ви проходили це знову',
			started: {
				anime: 'Початок перегляду',
				manga: 'Початок читання'
			},
			dateHint: 'Необовʼязково — лишіть порожнім, якщо не памʼятаєте',
			completed: {
				anime: 'Завершення перегляду',
				manga: 'Завершення читання'
			},
			completedLocked: 'Доступно, коли тайтл завершено, покинуто або переглядається повторно',
			notes: 'Нотатки',
			notesHint: 'Приватні нотатки, які бачите лише ви',
			notesPlaceholder: 'Усе, що хочете запамʼятати'
		},
		removeFromList: 'Прибрати зі списку',
		loading: 'Завантажуємо ваші списки…',
		failed: 'Не вдалося завантажити списки',
		retry: 'Повторити',
		empty: 'Тут поки порожньо',
		connect: 'Підключіть AniList, щоб побачити свої списки',
		pending: 'Ще не синхронізовано',
		menu: 'Дії з тайтлом',
		decrement: 'На один менше',
		increment: 'На один більше',
		updateFailed: 'Не вдалося зберегти зміну. Спробуйте ще раз',
		sync: {
			progress: 'Синхронізація з AniList…',
			done: 'Синхронізовано з AniList',
			delayed: 'Збережено на цьому компʼютері. Зміна потрапить в AniList, щойно він стане доступним'
		},
		episodes: 'Еп. {{progress}}',
		chapters: 'Гл. {{progress}}',
		editor: {
			status: 'Статус',
			score: 'Оцінка',
			episodes: 'Епізоди',
			chapters: 'Розділи',
			volumes: 'Томи',
			repeat: 'Повтори'
		},
		status: {
			anime: {
				CURRENT: 'Дивлюсь',
				PLANNING: 'Заплановано',
				COMPLETED: 'Переглянуто',
				DROPPED: 'Кинуто',
				PAUSED: 'На паузі',
				REPEATING: 'Передивляюсь'
			},
			manga: {
				CURRENT: 'Читаю',
				PLANNING: 'Заплановано',
				COMPLETED: 'Прочитано',
				DROPPED: 'Кинуто',
				PAUSED: 'На паузі',
				REPEATING: 'Перечитую'
			}
		}
	},

	library: {
		summary: {
			files_one: '{{count}} файл',
			files_few: '{{count}} файли',
			files_many: '{{count}} файлів',
			files_other: '{{count}} файла',
			unmatched_one: '{{count}} без тайтла',
			unmatched_few: '{{count}} без тайтла',
			unmatched_many: '{{count}} без тайтла',
			unmatched_other: '{{count}} без тайтла'
		},
		empty: {
			title: 'Тек бібліотеки ще немає',
			description:
				'Вкажіть ноді теку з вашими файлами. Вона обійде й підтеки, а знайдене зіставить із AniList'
		},
		root: {
			add: 'Додати теку',
			remove: 'Прибрати цю теку',
			removeFailed: 'Не вдалося прибрати теку',
			failed: 'Не вдалося додати теку',
			overlap: 'Ця тека перетинається з тією, яку нода вже стежить',
			files_one: '{{count}} файл',
			files_few: '{{count}} файли',
			files_many: '{{count}} файлів',
			files_other: '{{count}} файла',
			missing_one: '{{count}} відсутній',
			missing_few: '{{count}} відсутні',
			missing_many: '{{count}} відсутніх',
			missing_other: '{{count}} відсутнього',
			section: 'Корені бібліотеки',
			menu: 'Дії з текою',
			rescan: 'Пересканувати цю теку'
		},
		scan: {
			start: 'Сканувати',
			running: 'Сканування…',
			title: 'Сканування бібліотеки',
			walking: 'Обхід тек',
			probing: 'Читання тривалостей',
			matching: 'Зіставлення тайтлів',
			roots_one: '{{done}} з {{count}} теки',
			roots_few: '{{done}} з {{count}} тек',
			roots_many: '{{done}} з {{count}} тек',
			roots_other: '{{done}} з {{count}} теки',
			foundFiles_one: 'знайдено {{count}} файл',
			foundFiles_few: 'знайдено {{count}} файли',
			foundFiles_many: 'знайдено {{count}} файлів',
			foundFiles_other: 'знайдено {{count}} файла',
			ofTotal: '{{done}} з {{total}}',
			neverRun: 'Ще не скановано',
			finished: 'Завершено {{when}}',
			matchedFiles_one: 'зіставлено {{count}}',
			matchedFiles_few: 'зіставлено {{count}}',
			matchedFiles_many: 'зіставлено {{count}}',
			matchedFiles_other: 'зіставлено {{count}}',
			allRead: 'Усі теки прочитано',
			tally: {
				added: 'Нових',
				changed: 'Змінених',
				missing: 'Зниклих'
			},
			failedTitle: 'Не вдалося прочитати:',
			showMore_one: 'Показати ще {{count}}',
			showMore_few: 'Показати ще {{count}}',
			showMore_many: 'Показати ще {{count}}',
			showMore_other: 'Показати ще {{count}}',
			showLess: 'Згорнути',
			failures: 'Теки, які не вдалося прочитати',
			rootFailed: 'Теку не вдалося прочитати: {{reason}}'
		},
		search: 'Пошук за назвою, тайтлом, файлом…',
		view: {
			all: 'Усі',
			unmatched: 'Без тайтла',
			missing: 'Відсутні'
		},
		layout: {
			grid: 'Картки',
			rows: 'Компактно'
		},
		group: {
			matched: 'Зіставлено',
			unmatched: 'Без тайтла',
			season: 'Сезон {{number}}',
			seasons_one: '{{count}} сезон',
			seasons_few: '{{count}} сезони',
			seasons_many: '{{count}} сезонів',
			seasons_other: '{{count}} сезону',
			episodes_one: '{{count}} серія',
			episodes_few: '{{count}} серії',
			episodes_many: '{{count}} серій',
			episodes_other: '{{count}} серії',
			more_one: 'ще {{count}} серія',
			more_few: 'ще {{count}} серії',
			more_many: 'ще {{count}} серій',
			more_other: 'ще {{count}} серії',
			less: 'Згорнути',
			collapse: 'Згорнути',
			expand: 'Розгорнути'
		},
		loading: 'Читаємо бібліотеку…',
		failed: 'Нода не віддала бібліотеку',
		retry: 'Повторити',
		noFiles: 'Ще нічого не сканували',
		noFilesHint: 'Натисніть «Сканувати», щоб нода обійшла додані теки',
		noMatches: 'Під цей фільтр не підпадає жоден файл',
		truncated: 'Показано {{shown}} з {{total}} файлів',
		file: {
			missing: 'Відсутній',
			matched: 'Зіставлено {{percent}}%',
			matchedByHand: 'Зіставлено вручну',
			unmatched: 'Без тайтла',
			play: 'Дивитись',
			match: 'Зіставити',
			change: 'Змінити',
			clear: 'Забути зіставлення',
			unknownTitle: 'Не розпізнано',
			season: 'Сезон {{number}}',
			episode: 'Серія {{number}}',
			chapter: 'Розділ {{number}}',
			menu: 'Дії з файлом',
			reveal: 'Показати в теці'
		},
		form: {
			series: 'Серія',
			movie: 'Фільм',
			special: 'Спешл',
			extra: 'Додаткове',
			manga: 'Глава',
			book: 'Книга'
		},
		match: {
			title: 'Що це за файл?',
			loading: 'Запитуємо джерело…',
			loadFailed: 'Не вдалося отримати варіанти',
			failed: 'Не вдалося зберегти зіставлення',
			none: 'Варіантів немає',
			noneHint:
				'Нічого достатньо схожого джерело не знає. Зазвичай допомагає перейменувати файл ближче до назви тайтла',
			tracked: 'У вашому списку',
			noSource: 'Джерело метаданих не підключено',
			offline: 'Нода недоступна'
		}
	},

	media: {
		back: 'Назад',
		failed: 'Не вдалося завантажити тайтл',
		retry: 'Повторити',
		offline: 'Подробиці зараз недоступні. Показуємо те, що відомо з вашого списку',
		openOn: 'Відкрити на {{name}}',
		addToList: 'Додати до списку',
		trailer: 'Трейлер',
		trailerFor: 'Трейлер: {{title}}',
		downloadBatch: 'Завантажити пакет / {{count}} епізодів',
		comingSoon: 'Скоро буде',
		nextAiringDay: 'Епізод {{episode}} {{when}}',
		views: {
			library: 'Локальна бібліотека',
			torrent: 'Торент-стрімінг'
		},
		library: {
			notInLibrary: 'Немає у вашій бібліотеці',
			episodesNotInLibrary: 'Цих епізодів немає у вашій бібліотеці:',
			episode: 'Епізод {{number}}',
			metadataUnavailable: 'Дані про епізоди ще недоступні — бібліотека в розробці',
			andMore: 'Та інші…'
		},
		menu: {
			label: 'Більше дій',
			details: 'Подробиці',
			addToLibrary: 'Додати до бібліотеки'
		},
		sections: {
			synopsis: 'Опис',
			details: 'Подробиці',
			relations: 'Повʼязані тайтли'
		},
		noDescription: 'Опису поки немає',
		stats: {
			averageScore: 'Середня оцінка',
			popularity: 'Користувачів',
			favourites: 'В улюблених'
		},
		fields: {
			format: 'Формат',
			status: 'Статус',
			episodes: 'Епізоди',
			chapters: 'Розділи',
			volumes: 'Томи',
			duration: 'Тривалість епізоду',
			start: 'Початок',
			end: 'Завершення',
			studios: 'Студії',
			source: 'Першоджерело',
			country: 'Країна',
			synonyms: 'Також відомий як'
		},
		minutes: '{{count}} хв',
		format: {
			TV: 'ТБ',
			TV_SHORT: 'Короткий ТБ',
			MOVIE: 'Фільм',
			SPECIAL: 'Спешл',
			OVA: 'OVA',
			ONA: 'ONA',
			MUSIC: 'Кліп',
			MANGA: 'Манга',
			NOVEL: 'Ранобе',
			ONE_SHOT: 'Ваншот'
		},
		status: {
			FINISHED: 'Завершено',
			RELEASING: 'Виходить',
			NOT_YET_RELEASED: 'Ще не вийшов',
			CANCELLED: 'Скасовано',
			HIATUS: 'На паузі'
		},
		season: {
			WINTER: 'Зима',
			SPRING: 'Весна',
			SUMMER: 'Літо',
			FALL: 'Осінь'
		},
		relation: {
			ADAPTATION: 'Адаптація',
			PREQUEL: 'Приквел',
			SEQUEL: 'Сиквел',
			PARENT: 'Основна історія',
			SIDE_STORY: 'Побічна історія',
			CHARACTER: 'Персонаж',
			SUMMARY: 'Рекап',
			ALTERNATIVE: 'Альтернатива',
			SPIN_OFF: 'Спінофф',
			OTHER: 'Інше',
			SOURCE: 'Першоджерело',
			COMPILATION: 'Компіляція',
			CONTAINS: 'Містить'
		},
		origin: {
			ORIGINAL: 'Оригінал',
			MANGA: 'Манга',
			LIGHT_NOVEL: 'Ранобе',
			VISUAL_NOVEL: 'Візуальна новела',
			VIDEO_GAME: 'Відеогра',
			OTHER: 'Інше',
			NOVEL: 'Роман',
			DOUJINSHI: 'Доджінші',
			ANIME: 'Аніме',
			WEB_NOVEL: 'Веб-новела',
			LIVE_ACTION: 'Живі актори',
			GAME: 'Гра',
			COMIC: 'Комікс',
			MULTIMEDIA_PROJECT: 'Мультимедійний проєкт',
			PICTURE_BOOK: 'Книжка з картинками'
		}
	},

	search: {
		subtitle: 'Знаходьте аніме, мангу, дорами, фільми, серіали й книги',
		searchPlaceholder: 'Назва',
		searchLabel: 'Пошук за назвою',
		filters: 'Фільтри',
		clear: 'Скинути фільтри',
		adult: 'Показувати контент 18+',
		empty: 'Нічого не знайдено. Спробуйте іншу назву або змініть фільтри',
		failed: 'Не вдалося виконати пошук',
		loadMoreFailed: 'Не вдалося завантажити ще тайтли',
		retry: 'Повторити',
		loadMore: 'Показати ще',
		scoreAtLeast: 'Від {{score}}%',
		type: {
			anime: 'Аніме',
			manga: 'Манга'
		},
		sort: {
			POPULARITY_DESC: 'Найпопулярніші',
			SEARCH_MATCH: 'За збігом',
			TRENDING_DESC: 'У тренді',
			SCORE_DESC: 'За оцінкою',
			FAVOURITES_DESC: 'В улюблених',
			START_DATE_DESC: 'Найновіші',
			TITLE_ROMAJI: 'За назвою'
		},
		any: {
			genres: 'Усі жанри',
			tags: 'Усі теги',
			formats: 'Усі формати',
			seasons: 'Будь-який сезон',
			year: 'Будь-який рік',
			statuses: 'Будь-який статус',
			score: 'Будь-яка оцінка'
		}
	},

	playback: {
		episode: 'Серія {{number}}',
		watched: 'Зараховано як переглянуте',
		pause: 'Пауза',
		resume: 'Продовжити',
		stop: 'Закрити плеєр',
		failed: 'Не вдалося запустити плеєр'
	},

	placeholder: {
		discover: 'Тут зʼявляться рекомендації та свіжі релізи, щойно буде підключено хмарний каталог',
		downloads: 'Джерела торентів і черга завантажень, якою керує нода'
	},

	settings: {
		appearance: {
			name: 'Вигляд',
			hint: 'Світла або темна тема для всього застосунку'
		},
		language: {
			name: 'Мова',
			hint: 'Мова інтерфейсу. Назви в каталозі лишаються своїми мовами'
		},
		wizard: {
			name: 'Майстер налаштування',
			hint: 'Пройти первинне налаштування ще раз: теки, плеєр, завантаження',
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
				'Аніме, манга, дорами, фільми, серіали й книги — один каталог, один прогрес, на всіх пристроях',
			aside: 'Акаунт потрібен лише для хмарного каталогу й синхронізації. Локальна бібліотека, плеєр і завантаження працюють і без нього'
		},
		back: 'Повернутися назад',
		or: 'або',
		otherWay: 'Інший спосіб входу',
		providers: {
			label: 'Продовжити через',
			lastUsed: 'Минулого разу',
			waiting: 'Очікування {{provider}} у браузері',
			cancel: 'Скасувати',
			unavailable: 'Не вдалося завантажити способи входу',
			reload: 'Спробувати ще раз',
			failed: 'Не вдалося увійти через {{provider}}. Спробуйте ще раз'
		},
		signIn: {
			eyebrow: 'З поверненням',
			title: 'Вітаємо!',
			subtitle: 'Оберіть, як вам зручніше увійти',
			emailTitle: 'Вхід',
			emailSubtitle: 'Увійдіть, щоб продовжити з того самого місця',
			submit: 'Увійти',
			useEmail: 'Увійти через пошту й пароль',
			forgotPassword: 'Забули пароль?',
			noAccount: 'Немає акаунта?',
			switch: 'Зареєструватися'
		},
		signUp: {
			eyebrow: 'Приєднуйтеся',
			title: 'Створити акаунт',
			subtitle: 'Оберіть, як вам зручніше зареєструватися',
			emailTitle: 'Реєстрація',
			emailSubtitle: 'Кілька полів — і готово',
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
			description: 'Введіть код із {{length}} цифр, який ми надіслали на {{email}}',
			submit: 'Підтвердити пошту',
			resendLabel: 'Не отримали код?',
			resend: 'Надіслати новий'
		},
		reset: {
			eyebrow: 'Відновлення доступу',
			title: 'Скидання пароля',
			description: 'Вкажіть пошту, з якою реєструвалися. Якщо на ній є акаунт, код уже в дорозі',
			submit: 'Надіслати код',
			backToSignIn: 'Повернутися до входу'
		},
		newPassword: {
			eyebrow: 'Останній крок',
			title: 'Новий пароль',
			description: 'Введіть код, надісланий на {{email}}, і придумайте новий пароль',
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
		pending: 'Цей крок ще не зроблено',
		steps: {
			library: {
				label: 'Локальна бібліотека',
				title: 'Локальна бібліотека',
				description:
					'Оберіть теки, де вже лежать ваші файли. Mediary просканує їх і зіставить знайдене з каталогом'
			},
			player: {
				label: 'Плеєр',
				title: 'Зовнішній плеєр',
				description:
					'Оберіть, чим відтворювати аніме, фільми й серіали. Прогрес відстежується автоматично'
			},
			downloads: {
				label: 'Завантаження',
				title: 'Завантаження файлів',
				description: 'Налаштуйте торент-клієнт для завантаження'
			},
			anilist: {
				label: 'AniList',
				title: 'Підключіть AniList',
				description:
					'Списки аніме й манги живуть у вашому акаунті AniList. Підключіть його один раз, і Mediary триматиме їх синхронізованими'
			},
			account: {
				label: 'Бекап',
				title: 'Акаунт Mediary',
				description:
					'Необовʼязково. Акаунт Mediary лише зберігає бекап ваших списків і налаштувань для інших пристроїв'
			},
			debrid: {
				label: 'Debrid-сервіс',
				title: 'Debrid-сервіс',
				description: 'Debrid-сервіси пришвидшують завантаження й дають миттєвий стрімінг із хмари'
			}
		},
		account: {
			blurb: 'Акаунт Mediary необовʼязковий: він лише зберігає бекап ваших списків і налаштувань для переходу на інший пристрій',
			google: 'Продовжити через Google',
			or: 'або',
			email: 'Продовжити через email'
		},
		library: {
			placeholder: 'Теку не обрано',
			browse: 'Обрати теку',
			video: {
				label: 'Відео',
				hint: 'Аніме, фільми й серіали. Вкладені теки теж скануються'
			},
			reading: {
				label: 'Читання',
				hint: 'Манга, манхва й книги'
			},
			aside: 'Це можна пропустити й додати теки згодом — каталог працює й без локальної бібліотеки'
		},
		player: {
			notice: 'Нода Mediary має вбудований плеєр на базі mpv. Нижче все одно можна налаштувати зовнішній',
			select: {
				label: 'Плеєр для десктопа',
				mpv: 'MPV (Рекомендовано)',
				vlc: 'VLC',
				custom: 'Своя команда',
				hint: 'MPV рекомендовано для кращого рендерингу субтитрів і торент-стримінгу'
			},
			install: 'У Windows встановіть MPV через Scoop або Chocolatey. У macOS — через Homebrew'
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
			description: 'Адреса помилкова, або екран прибрали',
			home: 'На головну'
		},
		error: {
			title: 'Щось пішло не так',
			description: 'Не вдалося відкрити екран. Спробуйте ще раз або поверніться на головну',
			retry: 'Спробувати ще раз'
		}
	},
	home: {
		subtitle: 'Скелет фази 0. Каталогу ще немає — тут лише перевірка, що оболонка бачить ноду',
		account: {
			title: 'Хмарний акаунт',
			anonymous: 'Не увійдено — каталог і синхронізація недоступні',
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
