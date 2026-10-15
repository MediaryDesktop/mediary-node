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
		library: 'Локальна бібліотека',
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
		cancel: 'Скасувати',
		breadcrumbs: 'Шлях навігації'
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
			current: 'В процесі'
		},
		manage: {
			new: 'Новий список',
			createTitle: 'Створити список',
			createSubtitle: 'Список тримає один тип медіа, тож тайтли лишаються там, де їм місце',
			renameTitle: 'Редагувати список',
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
			iconLabel: 'Іконка',
			iconHint: 'Показується поруч із назвою списку. Якщо жодна не пасує — лишіть стандартну',
			iconDefault: 'Стандартна',
			iconSearch: 'Пошук іконок (англійською)',
			iconCount: '{{count}} іконок',
			iconNoMatches: 'Іконки з такою назвою немає',
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
		addEntry: {
			action: 'Додати до списку',
			title: 'Додати до списку',
			save: 'Додати',
			done: '{{title}} додано до вашого списку AniList',
			doneLocal: '{{title}} додано до вашого списку'
		},
		manageEntry: {
			action: 'Керувати списками',
			title: 'Керувати списками',
			save: 'Зберегти зміни',
			statusHint: 'Де цей тайтл у ваших списках AniList',
			statusHintLocal: 'Статус тайтлу у вашому власному списку',
			newList: 'Новий список',
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
				manga: 'Початок читання',
				movie: 'Початок перегляду',
				series: 'Початок перегляду',
				dorama: 'Початок перегляду',
				book: 'Початок читання'
			},
			dateHint: 'Необовʼязково — лишіть порожнім, якщо не памʼятаєте',
			completed: {
				anime: 'Завершення перегляду',
				manga: 'Завершення читання',
				movie: 'Завершення перегляду',
				series: 'Завершення перегляду',
				dorama: 'Завершення перегляду',
				book: 'Завершення читання'
			},
			completedLocked: 'Доступно, коли тайтл завершено, покинуто або переглядається повторно',
			notes: 'Нотатки',
			notesHint: 'Приватні нотатки, які бачите лише ви',
			notesPlaceholder: 'Усе, що хочете запамʼятати'
		},
		removeFromList: 'Прибрати зі списку',
		deleteEntry: 'Прибрати з мого списку',
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
			pages: 'Сторінки',
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
			},
			movie: {
				CURRENT: 'Дивлюсь',
				PLANNING: 'Заплановано',
				COMPLETED: 'Переглянуто',
				DROPPED: 'Кинуто',
				PAUSED: 'На паузі',
				REPEATING: 'Передивляюсь'
			},
			series: {
				CURRENT: 'Дивлюсь',
				PLANNING: 'Заплановано',
				COMPLETED: 'Переглянуто',
				DROPPED: 'Кинуто',
				PAUSED: 'На паузі',
				REPEATING: 'Передивляюсь'
			},
			dorama: {
				CURRENT: 'Дивлюсь',
				PLANNING: 'Заплановано',
				COMPLETED: 'Переглянуто',
				DROPPED: 'Кинуто',
				PAUSED: 'На паузі',
				REPEATING: 'Передивляюсь'
			},
			book: {
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
		description: 'Керування локальними файлами, теками та зіставленнями тайтлів',
		summary: {
			files_one: '{{count}} файл',
			files_few: '{{count}} файли',
			files_many: '{{count}} файлів',
			files_other: '{{count}} файла',
			filesOf_one: '{{count}}/{{total}} серія',
			filesOf_few: '{{count}}/{{total}} серії',
			filesOf_many: '{{count}}/{{total}} серій',
			filesOf_other: '{{count}}/{{total}} серії',
			unmatched_one: '{{count}} без тайтла',
			unmatched_few: '{{count}} без тайтла',
			unmatched_many: '{{count}} без тайтла',
			unmatched_other: '{{count}} без тайтла',
			titles_one: '{{count}} тайтл',
			titles_few: '{{count}} тайтли',
			titles_many: '{{count}} тайтлів',
			titles_other: '{{count}} тайтла'
		},
		empty: {
			title: 'Тек бібліотеки ще немає',
			description:
				'Вкажіть ноді теку з вашими файлами. Вона обійде й підтеки, а знайдене автоматично доповнить деталями',
			action: 'Додати теку в налаштуваннях'
		},
		root: {
			add: 'Додати теку',
			note: 'Тип теки підказує ноді, що в ній. Для відео він обирає, звідки брати назви: аніме — з AniList, фільми, серіали й дорами — з TMDB. Відео-тека підхоплює також манґу й книжки; тека манґи чи книг тримає лише їх.',
			content: {
				anime: 'Аніме',
				movies_and_shows: 'Фільми й серіали',
				doramas: 'Дорами',
				manga: 'Манґа',
				books: 'Книги'
			},
			addAs: {
				anime: 'Тека з аніме',
				movies_and_shows: 'Тека з фільмами й серіалами',
				doramas: 'Тека з дорамами',
				manga: 'Тека з манґою',
				books: 'Тека з книгами'
			},
			switchTo: {
				anime: 'Тут аніме',
				movies_and_shows: 'Тут фільми й серіали',
				doramas: 'Тут дорами',
				manga: 'Тут лише манґа',
				books: 'Тут лише книги'
			},
			contentFailed: 'Не вдалося змінити вміст теки',
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
			rescan: 'Пересканувати цю теку',
			none: 'Тек ще немає'
		},
		scan: {
			start: 'Сканувати',
			folders: 'Теки',
			allFolders: 'Усі теки бібліотеки',
			failed: 'Не вдалося запустити сканування',
			noRoots: 'Додайте теку бібліотеки в налаштуваннях, щоб сканувати',
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
		explorer: {
			title: 'Провідник бібліотеки',
			search: 'Пошук файлів і тек…',
			nothing: 'За цим фільтром нічого немає',
			pickSomething: 'Виберіть файл або теку, щоб побачити, що про них знає нода',
			folderMeta: '{{matched}} з {{count}} зіставлено',
			selectRow: 'Вибрати {{name}}',
			extension: 'Файл {{extension}}',
			folder: 'Тека',
			path: 'Шлях',
			libraryFile: 'Файл бібліотеки',
			files: 'Файлів',
			matchedTitle: 'Тайтл',
			season: 'Сезон',
			episode: 'Епізод',
			duration: 'Тривалість',
			size: 'Розмір',
			kind: 'Тип',
			form: 'Форма',
			unmatchedPill_one: '{{count}} незіставлений файл',
			unmatchedPill_few: '{{count}} незіставлені файли',
			unmatchedPill_many: '{{count}} незіставлених файлів',
			unmatchedPill_other: '{{count}} незіставленого файлу',
			matchFiles_one: 'Зіставити {{count}} файл',
			matchFiles_few: 'Зіставити {{count}} файли',
			matchFiles_many: 'Зіставити {{count}} файлів',
			matchFiles_other: 'Зіставити {{count}} файлу',
			unmatchFiles_one: 'Розʼєднати {{count}} файл',
			unmatchFiles_few: 'Розʼєднати {{count}} файли',
			unmatchFiles_many: 'Розʼєднати {{count}} файлів',
			unmatchFiles_other: 'Розʼєднати {{count}} файлу',
			ignoreFiles_one: 'Відкласти {{count}} файл',
			ignoreFiles_few: 'Відкласти {{count}} файли',
			ignoreFiles_many: 'Відкласти {{count}} файлів',
			ignoreFiles_other: 'Відкласти {{count}} файлу',
			unignoreFiles_one: 'Повернути {{count}} файл',
			unignoreFiles_few: 'Повернути {{count}} файли',
			unignoreFiles_many: 'Повернути {{count}} файлів',
			unignoreFiles_other: 'Повернути {{count}} файлу',
			deleteFiles_one: 'Видалити {{count}} файл',
			deleteFiles_few: 'Видалити {{count}} файли',
			deleteFiles_many: 'Видалити {{count}} файлів',
			deleteFiles_other: 'Видалити {{count}} файлу',
			deleteTitle_one: 'Видалити {{count}} файл із диска?',
			deleteTitle_few: 'Видалити {{count}} файли з диска?',
			deleteTitle_many: 'Видалити {{count}} файлів із диска?',
			deleteTitle_other: 'Видалити {{count}} файлу з диска?',
			andMore_one: 'і ще {{count}}',
			andMore_few: 'і ще {{count}}',
			andMore_many: 'і ще {{count}}',
			andMore_other: 'і ще {{count}}',
			filterAction: 'Фільтр',
			filterActive: 'Фільтр: {{filter}}',
			select: 'Вибрати',
			selecting: 'Вибір',
			refresh: 'Перечитати дерево',
			kinds: {
				video: 'Відео',
				manga: 'Комікс',
				book: 'Книга'
			},
			filter: {
				unmatched: 'Незіставлені файли',
				auto: 'Зіставлені нодою',
				ignored: 'Відкладені файли',
				missing: 'Відсутні файли'
			}
		},
		toolbar: {
			explorer: 'Провідник бібліотеки',
			refresh: 'Оновити',
			refreshHint: 'Пересканувати бібліотеку',
			scanHint: 'Сканувати бібліотеку',
			resolveUnmatched_one: 'Розібрати незіставлені ({{count}})',
			resolveUnmatched_few: 'Розібрати незіставлені ({{count}})',
			resolveUnmatched_many: 'Розібрати незіставлені ({{count}})',
			resolveUnmatched_other: 'Розібрати незіставлені ({{count}})',
			ignoredFiles: 'Відкладені файли',
			scanSummaries: 'Підсумки сканувань',
			more: 'Інші дії з бібліотекою'
		},
		unmatched: {
			title: 'Незіставлені файли',
			empty: 'Усі файли мають тайтл',
			previous: 'Попередня',
			next: 'Наступна',
			sourceId: 'AniList ID',
			matchSelection: 'Зіставити вибрані',
			selectAll: 'Вибрати всі файли',
			fetchSuggestions: 'Підібрати варіанти',
			ignoreSelection: 'Відкласти вибрані',
			pickTitle: 'Виберіть тайтл',
			confidence: 'Збіг {{percent}}%',
			onYourList: 'У вашому списку',
			ignoredTitle: 'Відкладені файли',
			noneIgnored: 'Відкладених файлів немає',
			unignoreSelection: 'Повернути вибрані',
			ignoreFailed_one: 'Не вдалося відкласти {{count}} файл',
			ignoreFailed_few: 'Не вдалося відкласти {{count}} файли',
			ignoreFailed_many: 'Не вдалося відкласти {{count}} файлів',
			ignoreFailed_other: 'Не вдалося відкласти {{count}} файлу'
		},
		history: {
			title: 'Підсумки сканувань',
			description: 'Усі скани, які виконала нода',
			empty: 'Сканувань ще не було',
			partial: 'Перервано',
			matchedTitle: 'Зіставлені тайтли',
			unmatchedTitle: 'Не вдалося зіставити',
			notYetOnYourList: 'Ще не у вашому списку',
			nothingToShow: 'Цей скан не має що показати',
			search: 'Пошук за назвою файлу…',
			scanned_one: 'Проскановано {{count}} тайтл',
			scanned_few: 'Проскановано {{count}} тайтли',
			scanned_many: 'Проскановано {{count}} тайтлів',
			scanned_other: 'Проскановано {{count}} тайтлу',
			notMatched_one: '{{count}} файл не зіставлено',
			notMatched_few: '{{count}} файли не зіставлено',
			notMatched_many: '{{count}} файлів не зіставлено',
			notMatched_other: '{{count}} файлу не зіставлено',
			onYourList: 'У вашому списку',
			filesScanned_one: 'Проскановано {{count}} файл',
			filesScanned_few: 'Проскановано {{count}} файли',
			filesScanned_many: 'Проскановано {{count}} файлів',
			filesScanned_other: 'Проскановано {{count}} файлу',
			openExplorer: 'Відкрити в провіднику бібліотеки',
			scannerLogs: 'Журнал сканера',
			parsedTitle: 'Прочитано з назви:',
			logMatched: 'Зіставлено на {{percent}}%',
			logRejected: 'Найближчий тайтл — {{percent}}%, нижче порогу',
			logNothing: 'Нема з чим порівняти'
		},
		search: 'Пошук за назвою, тайтлом, файлом…',
		view: {
			all: 'Усі',
			unmatched: 'Без тайтла',
			missing: 'Відсутні'
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
			less: 'Згорнути'
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
			ignore: 'Не чіпати цей файл',
			unignore: 'Знову враховувати',
			ignored: 'Відкладено',
			ignoreFailed: 'Не вдалося відкласти файл',
			deleteFile: 'Видалити з диска',
			deleteFileTitle: 'Видалити цей файл?',
			deleteFileWarning: 'Файл буде видалено з цього компʼютера. Це не можна скасувати.',
			deleteFailed: 'Не вдалося видалити файл',
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
			group_one: '{{count}} файл буде зіставлено з вибраним тайтлом',
			group_few: '{{count}} файли буде зіставлено з вибраним тайтлом',
			group_many: '{{count}} файлів буде зіставлено з вибраним тайтлом',
			group_other: '{{count}} файлу буде зіставлено з вибраним тайтлом',
			someFailed_one: 'Не вдалося зіставити {{count}} файл',
			someFailed_few: 'Не вдалося зіставити {{count}} файли',
			someFailed_many: 'Не вдалося зіставити {{count}} файлів',
			someFailed_other: 'Не вдалося зіставити {{count}} файлу',
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
		searchTorrents: 'Шукати торенти',
		downloadMissing_one: 'Завантажити · бракує {{count}}',
		downloadMissing_few: 'Завантажити · бракує {{count}}',
		downloadMissing_many: 'Завантажити · бракує {{count}}',
		downloadMissing_other: 'Завантажити · бракує {{count}}',
		back: 'Назад',
		failed: 'Не вдалося завантажити тайтл',
		failedHint: 'Джерело не відповіло вчасно. Спробуйте ще раз за мить.',
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
			torrent: 'Торенти'
		},
		chapters: {
			title: 'Глави · {{count}}'
		},
		books: {
			title: 'Файли в бібліотеці'
		},
		library: {
			notInLibrary: 'Немає у вашій бібліотеці',
			episodesNotInLibrary: 'Цих епізодів немає у вашій бібліотеці:',
			episode: 'Епізод {{number}}',
			seasonEpisode: 'Сезон {{season}} · Серія {{number}}',
			season: 'Сезон {{number}}',
			metadataUnavailable: 'Жодне джерело поки не має даних про епізоди цього тайтлу',
			andMore: 'Та інші…',
			toWatch: 'Далі до перегляду',
			specials: 'Спешели',
			others: 'Інше',
			play: 'Дивитися: {{name}}',
			playing: 'Грає',
			watched: 'Переглянуто',
			missing: 'Останній скан не знайшов файл',
			minutes: '{{count}} хв',
			aired: 'Вийшов {{date}}',
			about: 'Про епізод',
			previous: 'Попередні епізоди',
			next: 'Наступні епізоди'
		},
		menu: {
			label: 'Більше дій',
			details: 'Подробиці',
			addToLibrary: 'Додати до бібліотеки'
		},
		sections: {
			synopsis: 'Опис',
			details: 'Подробиці',
			relations: 'Повʼязані тайтли',
			recommendations: 'Рекомендації',
			recommended: 'Рекомендовані',
			similar: 'Схожі'
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
			authors: 'Автори',
			pages: 'Сторінки',
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
			ONE_SHOT: 'Ваншот',
			BOOK: 'Книга'
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
			manga: 'Манга',
			movie: 'Фільми',
			series: 'Серіали',
			dorama: 'Дорами',
			book: 'Книги'
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

	player: {
		play: 'Відтворити',
		pause: 'Пауза',
		mute: 'Вимкнути звук',
		unmute: 'Увімкнути звук',
		volume: 'Гучність',
		seek: 'Позиція',
		audio: 'Аудіодоріжка',
		subtitles: 'Субтитри',
		subtitlesOff: 'Вимкнено',
		fullscreen: 'На весь екран',
		exitFullscreen: 'Вийти з повноекранного режиму',
		minimize: 'Назад до сторінки',
		expand: 'Відкрити плеєр',
		failed: 'Вбудований плеєр не зміг відтворити цей файл.',
		loadFailed: 'Не вдалося прочитати цей файл.',
		needsTranscode:
			'Цей файл використовує кодеки, які вбудований плеєр поки не декодує. Його можна відкрити в mpv.',
		openExternally: 'Відкрити в mpv'
	},
	reader: {
		close: 'Назад',
		pageAlt: 'Сторінка {{number}}',
		empty: 'У цьому розділі немає сторінок, які можна показати.',
		counted: 'Зараховано як прочитане',
		read: 'Прочитано',
		loadFailed: 'Не вдалося відкрити цей розділ.',
		seek: 'Сторінка',
		previousChapter: 'Попередній розділ',
		nextChapter: 'Наступний розділ',
		pageOf: '{{current}} / {{total}}',
		end: 'Кінець розділу',
		chapterNumber: 'Розділ {{number}}',
		book: {
			read: 'Читати',
			loadFailed: 'Не вдалося відкрити книжку.',
			unreadable: 'Цю книжку не вдалося показати. Можливо, файл пошкоджений або захищений.',
			contents: 'Зміст',
			chapters: 'Розділи',
			contentsProgress_one: '{{current}} з {{count}} розділу',
			contentsProgress_few: '{{current}} з {{count}} розділів',
			contentsProgress_many: '{{current}} з {{count}} розділів',
			contentsProgress_other: '{{current}} з {{count}} розділу',
			contentsTotal_one: '{{count}} розділ',
			contentsTotal_few: '{{count}} розділи',
			contentsTotal_many: '{{count}} розділів',
			contentsTotal_other: '{{count}} розділу',
			smaller: 'Менший текст',
			larger: 'Більший текст',
			theme: {
				dark: 'Темні сторінки',
				sepia: 'Сепія',
				light: 'Білі сторінки'
			},
			previousPage: 'Попередня сторінка',
			nextPage: 'Наступна сторінка',
			position: 'Місце в книжці',
			percent: '{{percent}}%'
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

	discover: {
		open: 'Детальніше',
		featured: 'Обрані тайтли',
		rowFailed: 'Цей ряд не вдалося завантажити.',
		tmdbNeeded: 'Для фільмів, серіалів і дорам потрібен ключ TMDB',
		sections: {
			trending: 'Зараз у тренді',
			thisSeason: 'Топ сезону',
			lastSeason: 'Найкраще минулого сезону',
			upcoming: 'Скоро вийде',
			movies: 'Популярні фільми',
			manga: 'Популярна манґа',
			manhwa: 'Популярна манхва',
			manhua: 'Популярна маньхуа',
			popular: 'Популярне',
			newest: 'Новинки',
			topRated: 'Найвищі оцінки',
			fantasy: 'Фентезі',
			scienceFiction: 'Наукова фантастика',
			mystery: 'Детективи'
		}
	},

	placeholder: {
		downloads: 'Джерела торентів і черга завантажень, якою керує нода'
	},

	mangaSources: {
		none: 'Серверів поки немає',
		add: 'Додати OPDS-сервер',
		menu: 'Дії з сервером',
		edit: 'Змінити',
		remove: 'Видалити',
		removeFailed: 'Не вдалося видалити сервер',
		saveFailed: 'Не вдалося зберегти сервер',
		drawer: {
			createTitle: 'Додати OPDS-сервер',
			editTitle: 'Змінити OPDS-сервер',
			description:
				'Адреса кореневого фіду каталогу, наприклад http://nas:25600/opds/v1.2/catalog для Komga',
			nameLabel: 'Назва',
			namePlaceholder: 'Komga вдома',
			urlLabel: 'Адреса',
			usernameLabel: 'Ім’я користувача',
			passwordLabel: 'Пароль',
			passwordHint: 'Нода зберігає його в окремому файлі й більше ніколи не показує',
			passwordKept: 'Залиште порожнім, щоб лишити збережений пароль',
			create: 'Додати',
			save: 'Зберегти',
			check: 'Перевірити з’єднання',
			ok: 'З’єднання є',
			problems: {
				unauthorized: 'Сервер не прийняв ім’я користувача або пароль',
				not_opds: 'За цією адресою немає OPDS-каталогу',
				unreachable: 'Не вдалося з’єднатися із сервером',
				other_host: 'Каталог посилається на інший сервер'
			}
		},
		chapters: {
			external: 'На сайті видавця',
			library: 'Бібліотека',
			all: 'Усі джерела',
			filter: 'Джерело',
			copies: 'Інші копії',
			link: 'Знайти на сервері',
			relink: 'Змінити серію',
			unlink: 'Відв’язати',
			from: 'з {{name}}',
			empty: 'У прив’язаній серії немає розділів, які можна читати посторінково',
			loadFailed: 'Не вдалося завантажити розділи онлайн',
			pages_one: '{{count}} сторінка',
			pages_few: '{{count}} сторінки',
			pages_many: '{{count}} сторінок',
			pages_other: '{{count}} сторінки'
		},
		mangadex: {
			enable: 'Читати розділи з MangaDex',
			languages: 'Мови, за пріоритетом',
			languagesPlaceholder: 'Виберіть мови',
			note: 'Сторінки читаються онлайн через ноду й не зберігаються. MangaDex і перекладачі вказані біля кожного розділу.',
			unavailable: 'MangaDex вимкнено на цій ноді',
			saveFailed: 'Не вдалося зберегти налаштування MangaDex'
		},
		downloads: {
			save: 'Зберегти на диск',
			saveAll: 'Зберегти все на диск',
			queued_one: '{{count}} розділ у черзі',
			queued_few: '{{count}} розділи в черзі',
			queued_many: '{{count}} розділів у черзі',
			queued_other: '{{count}} розділу в черзі',
			failedToQueue: 'Не вдалося поставити в чергу',
			folderTitle: 'Куди зберігати розділи',
			folderDescription:
				'Розділи зберігаються як CBZ у теці бібліотеки, тож одразу з’являються в бібліотеці',
			noFolders: 'Спершу додайте теку бібліотеки в налаштуваннях',
			folderPlaceholder: 'Виберіть теку',
			title: 'Розділи манги',
			empty: 'Ще нічого не збережено',
			cancel: 'Зупинити',
			retry: 'Спробувати ще раз',
			forget: 'Прибрати зі списку',
			progress: '{{done}} / {{total}} сторінок',
			states: {
				queued: 'Очікує',
				running: 'Зберігається',
				done: 'Збережено',
				failed: 'Помилка',
				cancelled: 'Зупинено'
			}
		},
		link: {
			matched: 'Збігається з AniList',
			title: 'Знайти серію',
			description: 'Виберіть серію, в якій лежать розділи цього тайтлу',
			sourceLabel: 'Сервер',
			searchLabel: 'Назва серії',
			search: 'Шукати',
			noResults: 'На цьому сервері нічого не знайдено',
			choose: 'Вибрати',
			failed: 'Не вдалося прив’язати серію'
		}
	},
	torrents: {
		section: {
			hint: 'Шукайте роздачі, додавайте свої й отримуйте нові серії автоматично'
		},
		setup: {
			openSettings: 'Відкрити налаштування',
			noClient: 'Торент-клієнт не вибрано',
			noClientHint:
				'Виберіть вбудований клієнт, підключіть qBittorrent або додайте ключ TorBox у налаштуваннях.',
			unreachable: 'Торент-клієнт не відповідає',
			noSources: 'Немає джерела пошуку',
			noSourcesHint: 'Додайте Jackett або Prowlarr у налаштуваннях, щоб шукати роздачі.'
		},
		add: 'Додати торент',
		drawer: {
			title: 'Додати торент',
			description:
				'Для «{{title}}». Після завантаження його відео з’являться в бібліотеці під цим тайтлом.',
			magnetLabel: 'Magnet-посилання',
			magnetPlaceholder: 'magnet:?xt=urn:btih:…',
			fileLabel: 'Або файл .torrent',
			chooseFile: 'Вибрати файл .torrent',
			clearFile: 'Прибрати файл',
			fileUnreadable: 'Не вдалося прочитати цей файл',
			submit: 'Завантажити',
			failed: 'Не вдалося додати торент',
			chooseFiles: 'Вибрати серії перед завантаженням'
		},
		files: {
			title: 'Вибір файлів',
			choose: 'Вибрати файли',
			start: 'Завантажити вибране',
			save: 'Зберегти',
			failed: 'Не вдалося змінити файли',
			loading: 'Завантаження списку файлів…',
			waiting: 'Очікуємо список файлів торента. Magnet-посилання спершу отримує його від пірів.',
			selected: 'Вибрано {{count}} · {{size}}',
			hint: 'Серії, що вже є в бібліотеці, не вибрані',
			all: 'Усі',
			missing: 'Відсутні серії',
			none: 'Жодного',
			episode: 'Сер. {{number}}',
			seasonEpisode: 'Сезон {{season}} · Серія {{number}}',
			inLibrary: 'у бібліотеці'
		},
		search: {
			addedMany_one: 'Додано {{count}} завантаження',
			addedMany_few: 'Додано {{count}} завантаження',
			addedMany_many: 'Додано {{count}} завантажень',
			addedMany_other: 'Додано {{count}} завантажень',
			covers_one: '{{count}} відсутня серія',
			covers_few: '{{count}} відсутні серії',
			covers_many: '{{count}} відсутніх серій',
			covers_other: '{{count}} відсутніх серій',
			noEpisode: 'Без номера серії в назві',
			emptyHint: 'Спробуйте інший запит або вимкніть фільтри.',
			results_one: '{{count}} результат',
			results_few: '{{count}} результати',
			results_many: '{{count}} результатів',
			results_other: '{{count}} результатів',
			onlyMissing: 'Лише з відсутніми серіями',
			kind: {
				label: 'Роздачі',
				all: 'Усі',
				episodes: 'Серії',
				batches: 'Пакети'
			},
			downloadSelected: 'Завантажити ({{count}})',
			nothingMissing: 'Усі серії вже є',
			missing: 'Відсутні серії:',
			open: 'Шукати торенти',
			drawerTitle: 'Пошук торентів',
			placeholder: 'Пошук за назвами тайтлу або власним запитом',
			episode: 'Серія',
			submit: 'Шукати',
			best: 'Найкраща',
			cached: 'У кеші {{service}}',
			bestIs: 'Найкраща: {{title}}',
			downloadBest: 'Завантажити найкращу',
			queries: 'Шукали: {{queries}}',
			noSources: 'Додайте Jackett або Prowlarr у налаштуваннях, щоб шукати роздачі.',
			failed: 'Пошук не вдався',
			sourceFailed: '{{name}} не відповів: {{error}}',
			empty: 'Нічого не знайдено',
			download: 'Завантажити',
			added: 'Додано до завантажень',
			page: 'Відкрити сторінку роздачі',
			episodes: 'Сер. {{from}}–{{to}}',
			season: 'Сезон',
			seasonNumber: 'Сезон {{number}}',
			wholeSeason: 'Сезон {{number}} повністю',
			match: {
				episode: 'Ця серія',
				batch: 'Пакет'
			}
		},
		sources: {
			none: 'Джерел пошуку ще немає',
			add: 'Додати джерело',
			edit: 'Змінити',
			remove: 'Видалити',
			menu: 'Дії з джерелом',
			removeFailed: 'Не вдалося видалити джерело',
			createTitle: 'Нове джерело пошуку',
			editTitle: 'Змінити джерело пошуку',
			description: 'Torznab-стрічка з Jackett або Prowlarr. Які сайти вона шукає, налаштовується там.',
			nameLabel: 'Назва',
			urlLabel: 'Адреса Torznab',
			urlHint:
				'Jackett: «Copy Torznab Feed» на індексаторі або стрічка «all». Prowlarr: Torznab-адреса індексатора',
			keyLabel: 'API-ключ',
			keyKept: 'Лишіть порожнім, щоб зберегти поточний ключ',
			keyHint: 'Видно на головній сторінці Jackett або Prowlarr',
			check: 'Перевірити джерело',
			ok: '{{title}} відповідає й уміє шукати',
			noSearch: '{{title}} відповідає, але не приймає пошук',
			unreachable: 'Джерело не відповіло',
			save: 'Зберегти',
			create: 'Додати',
			saveFailed: 'Не вдалося зберегти джерело'
		},
		profile: {
			resolution: 'Роздільність',
			codec: 'Кодек',
			any: 'Будь-яка',
			minSeeders: 'Мінімум сидів',
			preferred: 'Бажані слова, від найважливішого — групи, сайти',
			excluded: 'Ніколи не обирати роздачі з цими словами',
			preferCached: 'Віддавати перевагу роздачам, які вже є в {{service}}: вони приходять одразу',
			save: 'Зберегти уподобання',
			saveFailed: 'Не вдалося зберегти уподобання'
		},
		auto: {
			addedToast_one: 'Додано {{count}} завантаження',
			addedToast_few: 'Додано {{count}} завантаження',
			addedToast_many: 'Додано {{count}} завантажень',
			addedToast_other: 'Додано {{count}} завантажень',
			queryShort: 'пошук «{{query}}»',
			emptyHint: 'Увімкніть автозавантаження на вкладці «Торенти» тайтлу.',
			emptyTitle: 'Правил ще немає',
			intro: 'Правила кожні 30 хвилин шукають у ваших джерелах і додають найкращу роздачу кожної нової серії. Правило вмикається й налаштовується на вкладці «Торенти» тайтлу.',
			settings: 'Налаштування правила',
			panelHint: 'Нові серії завантажуються самі, перевірка кожні 30 хвилин',
			panelTitle: 'Автозавантаження',
			enable: 'Автоматично завантажувати нові серії',
			remove: 'Прибрати правило',
			hint: 'Кожні 30 хвилин Mediary шукає у ваших джерелах і додає найкращу роздачу кожної серії, якої немає в бібліотеці, а з пакетної роздачі бере лише відсутні серії.',
			from: 'Від серії',
			fromShort: 'від серії {{episode}}',
			query: 'Шукати',
			queryPlaceholder: 'Назви тайтлу',
			save: 'Зберегти',
			preview: 'Що буде завантажено',
			checkNow: 'Перевірити зараз',
			lastChecked_one: 'Перевірено {{when}}, додано {{count}}',
			lastChecked_few: 'Перевірено {{when}}, додано {{count}}',
			lastChecked_many: 'Перевірено {{when}}, додано {{count}}',
			lastChecked_other: 'Перевірено {{when}}, додано {{count}}',
			nothing: 'Нового для завантаження немає',
			wouldAdd_one: 'Буде додано {{count}} серію',
			wouldAdd_few: 'Буде додано {{count}} серії',
			wouldAdd_many: 'Буде додано {{count}} серій',
			wouldAdd_other: 'Буде додано {{count}} серій',
			added_one: 'Додано {{count}} серію',
			added_few: 'Додано {{count}} серії',
			added_many: 'Додано {{count}} серій',
			added_other: 'Додано {{count}} серій',
			saveFailed: 'Не вдалося зберегти правило',
			checkFailed: 'Перевірка не вдалася',
			listTitle: 'Автозавантаження',
			on: 'Увімкнено',
			off: 'Вимкнено'
		},
		list: {
			emptyForTitleHint: 'Знайдіть роздачі або додайте magnet-посилання.',
			emptyHint: 'Знайдіть роздачу на вкладці «Торенти» тайтлу.',
			inLibrary: 'У бібліотеці: {{count}}',
			active: 'Активні: {{count}}',
			title: 'Торенти',
			forTitle: 'Завантаження цього тайтлу',
			empty: 'Торент-завантажень ще немає',
			emptyForTitle: 'Для цього тайтлу ще нічого не завантажено'
		},
		states: {
			choosing: 'Чекає на вибір файлів',
			downloading: 'Завантажується',
			paused: 'На паузі',
			stalled: 'Шукає пірів',
			queued: 'У черзі клієнта',
			remote: '{{service}} качає',
			remoteQueued: 'Чекає на вільний слот {{service}}',
			checking: 'Перевірка файлів',
			metadata: 'Отримання метаданих торента',
			error: 'Клієнт повідомляє про помилку',
			importing: 'Додається в бібліотеку',
			done: 'У бібліотеці',
			failed: 'Не вдалося',
			unknown: 'Очікує на клієнт'
		},
		meta: {
			down: 'Швидкість завантаження',
			speed: '{{speed}}/с',
			seeds: '{{seeds}} сидів · {{peers}} пірів',
			eta: 'лишилось {{time}}',
			imported_one: '{{count}} локальний файл',
			imported_few: '{{count}} локальні файли',
			imported_many: '{{count}} локальних файлів',
			imported_other: '{{count}} локальних файлів'
		},
		pause: 'Пауза',
		resume: 'Продовжити',
		remove: 'Прибрати зі списку',
		removeWithFiles: 'Прибрати разом із файлами',
		menu: 'Дії із завантаженням',
		actionFailed: 'Не вдалося змінити завантаження',
		client: {
			notConfigured: 'Виберіть торент-клієнт у налаштуваннях, щоб завантажувати торенти',
			unreachable: 'Торент-клієнт не відповідає: {{error}}',
			openSettings: 'Відкрити налаштування'
		},
		settings: {
			clientLabel: 'Торент-клієнт',
			embedded: 'Вбудований',
			none: 'Немає',
			embeddedHint:
				'Mediary завантажує торенти сама, нічого більше встановлювати не треба. Чекає на пірів на порту 42069 і не відкриває його на роутері.',
			qbittorrentHint:
				'Ваш qBittorrent через його Web UI. Увімкніть Web UI в qBittorrent: Налаштування → Веб-інтерфейс.',
			debrid: 'Debrid-сервіс',
			debridHint:
				'Ваш власний debrid-акаунт: сервіс качає торент на своїх серверах, а Mediary забирає файли по HTTPS. Жодного BitTorrent-трафіку з цього комп’ютера.',
			serviceLabel: 'Сервіс',
			torboxFree: 'TorBox має безкоштовний план: один торент за раз, кілька на місяць.',
			noneHint: 'Торенти вимкнено.',
			notConfigured: 'Не підключено',
			configure: 'Підключити',
			edit: 'Змінити',
			drawerTitle: 'Торент-клієнт',
			drawerDescription: 'Який клієнт завантажує торенти в бібліотеку.',
			urlLabel: 'Адреса Web UI',
			usernameLabel: 'Ім’я користувача',
			passwordLabel: 'Пароль',
			passwordKept: 'Лишіть порожнім, щоб зберегти поточний пароль',
			passwordHint: 'Лишіть порожнім, якщо Web UI пускає цей комп’ютер без пароля',
			apiKeyLabel: 'Ключ API',
			apiKeyHint:
				'Скопіюйте його з {{page}}. Нода зберігає його в окремому файлі й більше ніколи не показує',
			apiKeyKept: 'Лишіть порожнім, щоб зберегти поточний ключ',
			check: 'Перевірити з’єднання',
			ok: 'Підключено до qBittorrent {{version}}',
			okAccount: 'Підключено: {{account}}',
			folderLabel: 'Тека завантажень',
			folderHint: 'Тека бібліотеки, куди зберігаються торенти, по підтеці на тайтл',
			folderPlaceholder: 'Виберіть теку бібліотеки',
			mappingLabel: 'Відповідність шляхів',
			mappingHint:
				'Лише якщо qBittorrent працює в Docker чи на іншому комп’ютері й бачить теку завантажень під іншим шляхом. Заповніть обидва поля або жодного.',
			mappingClient: 'Тека, як її бачить qBittorrent',
			mappingNode: 'Та сама тека на цьому комп’ютері',
			save: 'Зберегти',
			saveFailed: 'Не вдалося зберегти налаштування'
		}
	},
	downloads: {
		subtitle: 'Торенти, правила, що додають їх самі, і збережені розділи манги',
		tabs: {
			torrents: 'Торенти',
			auto: 'Автозавантаження',
			manga: 'Розділи манги'
		}
	},
	tmdb: {
		source: {
			user: 'Використовується ваш власний ключ.',
			build: 'Використовується ключ, вбудований у застосунок. Можна вказати власний.',
			none: 'Ключа ще немає: фільми, серіали й дорами не знайти, доки його не додано.'
		},
		keyPlaceholder: 'API key або read access token',
		save: 'Перевірити й зберегти',
		getKey: 'Отримати безкоштовний ключ на TMDB',
		useBuiltIn: 'Повернути вбудований ключ',
		saved: 'TMDB прийняв ключ',
		cleared: 'Повернуто вбудований ключ',
		saveFailed: 'Не вдалося зберегти ключ',
		disabled: 'TMDB вимкнено на цій ноді.',
		note: 'Ключ зберігається у файлі, який можете прочитати лише ви на цьому компʼютері, — не в бекапах. This product uses the TMDB API but is not endorsed or certified by TMDB.',
		openSettings: 'Відкрити налаштування TMDB'
	},
	googleBooks: {
		source: {
			user: 'Використовується ваш власний ключ.',
			build: 'Використовується ключ, вбудований у застосунок. Можна вказати власний.',
			none: 'Ключа ще немає: книжок, яких не знає Open Library, не знайти, доки його не додано.'
		},
		keyPlaceholder: 'API key від Google',
		save: 'Перевірити й зберегти',
		getKey: 'Увімкнути Books API у Google Cloud',
		useBuiltIn: 'Повернути вбудований ключ',
		saved: 'Google прийняв ключ',
		cleared: 'Повернуто вбудований ключ',
		saveFailed: 'Не вдалося зберегти ключ',
		disabled: 'Google Books вимкнено на цій ноді.',
		note: 'Запитується лише тоді, коли Open Library нічого не знайшла: Google рахує кожен запит у денну квоту. Ключ зберігається у файлі, який можете прочитати лише ви на цьому компʼютері, — не в бекапах.'
	},
	backup: {
		signedOut:
			'Бекапи зберігаються в акаунті Mediary. Увійдіть, щоб їх увімкнути, — усе інше працює і без акаунта.',
		signIn: 'Увійти',
		unverified: 'Підтвердьте email, щоб увімкнути бекапи.',
		verify: 'Підтвердити email',
		off: 'Ви увійшли як {{name}}. На цьому компʼютері бекапи вимкнено.',
		turnOn: 'Увімкнути бекапи',
		paired: 'Бекапи на цьому компʼютері увімкнено',
		pairFailed: 'Не вдалося увімкнути бекапи',
		lastBackup: 'Останній бекап {{when}}',
		noBackupYet: 'Бекапів ще немає: перший піде за кілька хвилин.',
		backUpNow: 'Зробити бекап зараз',
		backedUp: 'Бекап зроблено',
		unchanged: 'Від останнього бекапу нічого не змінилося',
		backUpFailed: 'Не вдалося зробити бекап',
		turnOff: 'Вимкнути на цьому компʼютері',
		empty: 'В акаунті ще немає бекапів.',
		listFailed: 'Не вдалося завантажити бекапи.',
		thisDevice: '{{name}} (цей компʼютер)',
		restore: 'Відновити',
		delete: 'Видалити бекап',
		deleteFailed: 'Не вдалося видалити бекап',
		restoreTitle: 'Відновити цей бекап?',
		restoreHint:
			'Локальний трекер і списки буде замінено бекапом з {{device}} від {{when}}. Копія поточного стану лишиться в теці даних.',
		restored: 'Бекап відновлено',
		restoreFailed: 'Не вдалося відновити бекап',
		note: 'У бекапі — трекер фільмів, серіалів і книг та ваші власні списки: без назв і постерів і без AniList — аніме й манга живуть в акаунті AniList.',
		banner: {
			outdated:
				'Ця версія Mediary більше не може робити бекапи — усе інше працює. Оновіться, щоб їх повернути.',
			update: 'Оновити'
		}
	},
	devices: {
		signedOut: 'Увійдіть в акаунт Mediary, щоб побачити спарені з ним компʼютери.',
		listFailed: 'Не вдалося завантажити пристрої.',
		empty: 'З акаунтом ще не спарено жодного компʼютера.',
		thisDevice: '{{name}} (цей компʼютер)',
		lastSeen: 'Активний {{when}}',
		revoke: 'Відкликати',
		revokeFailed: 'Не вдалося відкликати пристрій',
		note: 'Відкликаний компʼютер одразу перестає робити бекапи. Його бекапи лишаються в акаунті.'
	},
	settings: {
		sections: {
			app: {
				title: 'Застосунок',
				subtitle: 'Вигляд, мова та первинне налаштування'
			},
			backup: {
				title: 'Бекап',
				subtitle: 'Ваші списки в акаунті Mediary'
			},
			devices: {
				title: 'Пристрої',
				subtitle: 'Компʼютери, спарені з акаунтом'
			},
			library: {
				title: 'Локальна бібліотека',
				subtitle: 'Теки, які нода сканує на медіа'
			},
			player: {
				title: 'Відтворення відео',
				subtitle: 'Яким плеєром відкривати відео'
			},
			torrentClient: {
				title: 'Торент-клієнт',
				subtitle: 'Куди завантажуються торенти'
			},
			torrentSearch: {
				title: 'Пошук торентів',
				subtitle: 'Джерела Torznab для пошуку роздач'
			},
			torrentPreferences: {
				title: 'Вибір роздач',
				subtitle: 'Які роздачі пошук ставить першими'
			},
			mangaSources: {
				title: 'Джерела манги',
				subtitle: 'Каталоги OPDS з мангою та книгами'
			},
			tmdb: {
				title: 'TMDB',
				subtitle: 'Фільми, серіали й дорами'
			},
			googleBooks: {
				title: 'Google Books',
				subtitle: 'Книжки, яких не знає Open Library'
			},
			mangaDex: {
				title: 'MangaDex',
				subtitle: 'Читання розділів онлайн'
			},
			mangaDownloads: {
				title: 'Завантаження манги',
				subtitle: 'Де зберігаються завантажені розділи'
			}
		},
		tmdb: {
			name: 'Ключ TMDB',
			hint: 'Звідки беруться фільми, серіали й дорами'
		},
		googleBooks: {
			name: 'Ключ Google Books',
			hint: 'Де шукати книжки, яких не знає Open Library'
		},
		mangaDex: {
			name: 'MangaDex',
			hint: 'Читати розділи онлайн з MangaDex'
		},
		mangaDownloads: {
			name: 'Завантаження манги',
			hint: 'Тека бібліотеки, куди зберігаються розділи у форматі CBZ'
		},
		torrents: {
			name: 'Торенти',
			hint: 'Клієнт, який завантажує торенти у вашу бібліотеку'
		},
		torrentSearch: {
			name: 'Пошук торентів',
			hint: 'Ваш Jackett або Prowlarr через Torznab. Власних індексаторів у Mediary немає'
		},
		releaseProfile: {
			name: 'Уподобання щодо роздач',
			hint: 'Що пошук ставить першим і обирає як найкращу роздачу'
		},
		mangaSources: {
			name: 'Джерела манги',
			hint: 'Ваші власні OPDS-каталоги — Komga, Kavita, Calibre-Web — звідки читати розділи'
		},
		backup: {
			name: 'Бекапи',
			hint: 'Перенесення трекера й списків на інший компʼютер'
		},
		devices: {
			name: 'Спарені компʼютери',
			hint: 'Ноди, яким дозволено робити бекап в акаунт'
		},
		appearance: {
			name: 'Вигляд',
			hint: 'Світла або темна тема для всього застосунку'
		},
		language: {
			name: 'Мова',
			hint: 'Мова інтерфейсу. Назви в каталозі лишаються своїми мовами'
		},
		library: {
			name: 'Теки бібліотеки',
			hint: 'Теки, які нода обходить під час сканування. Підтеки теж'
		},
		player: {
			name: 'Плеєр',
			hint: 'Де відкриваються серії: у застосунку чи в mpv',
			modes: {
				builtin: 'Вбудований',
				external: 'mpv'
			}
		},
		wizard: {
			name: 'Майстер налаштування',
			hint: 'Пройти первинне налаштування ще раз: теки, плеєр, завантаження',
			action: 'Відкрити майстер'
		},
		node: {
			name: 'Нода',
			hint: 'Версія та збірка локальної ноди'
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
			signIn: 'Увійти',
			or: 'або',
			signUp: 'Створити акаунт'
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
		connect: 'Підключіть AniList, щоб бачити тут свої аніме й мангу',
		empty: 'У ваших списках поки порожньо. Знайдіть щось в Огляді чи Пошуку й додайте',
		banner: {
			label: 'Аніме в процесі',
			open: 'Детальніше',
			progress: 'Переглянуто',
			continue: 'Продовжити · {{episode}}'
		},
		continue: {
			title: 'Продовжити перегляд'
		},
		rows: {
			current: 'В процесі',
			planning: 'Заплановане',
			completed: 'Нещодавно завершене'
		},
		stats: {
			title: 'Статистика',
			titles: 'Тайтлів у списках',
			episodes: 'Серій переглянуто',
			chapters: 'Розділів прочитано',
			meanScore: 'Середня оцінка',
			topGenres: 'Улюблені жанри',
			topGenresNote: 'Найчастіші у ваших списках',
			completedThisMonth_one: '+{{count}} завершено цього місяця',
			completedThisMonth_few: '+{{count}} завершено цього місяця',
			completedThisMonth_many: '+{{count}} завершено цього місяця',
			completedThisMonth_other: '+{{count}} завершено цього місяця',
			typesNote_one: '{{count}} тип медіа',
			typesNote_few: '{{count}} типи медіа',
			typesNote_many: '{{count}} типів медіа',
			typesNote_other: '{{count}} типу медіа',
			acrossNote_one: 'у {{count}} тайтлі',
			acrossNote_few: 'у {{count}} тайтлах',
			acrossNote_many: 'у {{count}} тайтлах',
			acrossNote_other: 'у {{count}} тайтла',
			scoredNote_one: 'з {{count}} оціненого тайтлу',
			scoredNote_few: 'з {{count}} оцінених тайтлів',
			scoredNote_many: 'з {{count}} оцінених тайтлів',
			scoredNote_other: 'з {{count}} оціненого тайтлу',
			activity: {
				title: 'Динаміка',
				subtitle: 'Розпочаті й завершені тайтли',
				started: 'Розпочато',
				completed: 'Завершено',
				empty: 'У ваших списках ще немає дат початку чи завершення',
				range: {
					'6m': '6 міс',
					'1y': 'Рік',
					all: 'Весь час'
				}
			},
			genres: {
				title: 'Жанри',
				subtitle: 'Що ви дивитесь і читаєте',
				other: 'Інші',
				empty: 'Почніть щось дивитися — і тут зʼявляться жанри',
				center_one: 'жанр',
				center_few: 'жанри',
				center_many: 'жанрів',
				center_other: 'жанру'
			},
			scores: {
				title: 'Ваші оцінки',
				subtitle_one: '{{count}} оцінений тайтл',
				subtitle_few: '{{count}} оцінені тайтли',
				subtitle_many: '{{count}} оцінених тайтлів',
				subtitle_other: '{{count}} оціненого тайтлу',
				mean: 'у середньому',
				bucket: 'Оцінка {{score}}',
				titles: 'Тайтлів',
				empty: 'Оцініть тайтл — і тут зʼявиться розподіл'
			},
			topRated: {
				title: 'Ваш топ-5',
				subtitle: 'За вашими оцінками',
				empty: 'Ще нічого не оцінено'
			},
			byType: {
				title: 'За типами медіа',
				subtitle: 'Як кожен тип розподіляється за статусами',
				total: 'Разом',
				all: 'Усі'
			},
			status: {
				CURRENT: 'В процесі',
				PLANNING: 'Заплановано',
				COMPLETED: 'Завершено',
				PAUSED: 'Відкладено',
				DROPPED: 'Кинуто',
				REPEATING: 'Повторно'
			}
		}
	}
}
