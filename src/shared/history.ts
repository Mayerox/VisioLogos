import { lang } from './i18n'

export interface Release {
  version: string

  date: string
  ru: string[]
  en: string[]
}

export const HISTORY: Release[] = [
  {
    version: '1.0.2',
    date: '2026-10-15',
    ru: [
      'Живые фоны: в панели «Фон» появился раздел «Живые» — четыре встроенных движущихся фона («Огоньки», «Волны», «Звёзды», «Облака») и кнопка «Загрузить видео…» для своих роликов mp4, webm или mov. Фон идёт по кругу без звука и не начинается заново при смене слайда.',
      'Листание по голосу понимает тексты, где русские буквы набраны латинскими двойниками, как на многих сайтах песен, а слова, которых нет в словаре голосового модуля, слышит по похожим на них.',
      'Звук для распознавания очищается сильнее: бас и бочка срезаются круче, громкие всплески мягко сжимаются. На записях двадцати трёх песен слайды переключились 88 раз из 100 нужных вместо 63.',
      'Вход «по умолчанию» Windows больше не выбирается — программа сама находит USB-вход. «Проверить звук» при открытой песне ищет в звуке её слова, как при листании.',
      'Журнал листания: что программа слышала, когда переключала слайды и каких слов песни не знает; по желанию — с записью звука для разбора («Настройка звука» → «Открыть журнал»).',
      'Листание по голосу помечено как функция в тестировании; у фонов «Глубина» и «Бордо» снова видны названия.'
    ],
    en: [
      'Live backgrounds: the “Background” panel has a new “Live” section — four built-in moving backgrounds (“Lights”, “Waves”, “Stars”, “Clouds”) and an “Upload a video…” button for your own mp4, webm or mov clips. The background loops silently and does not restart when the slide changes.',
      'Turning slides by voice understands lyrics where Russian letters are typed with Latin look-alikes, as on many song sites, and hears words missing from the voice module dictionary through similar ones.',
      'The sound for recognition is cleaned more: bass and kick drum are cut more steeply, loud bursts are softly compressed. On recordings of twenty-three songs the slides turned 88 times out of 100 needed instead of 63.',
      'The Windows “default” input is no longer chosen — the program finds the USB input by itself. With a song open, “Check sound” listens for its words, just as when turning slides.',
      'A journal of turning slides: what the program heard, when it turned slides and which words of the song it does not know; optionally with a sound recording for review (“Sound settings” → “Open the journal”).',
      'Turning slides by voice is marked as a feature in testing; the “Depth” and “Bordeaux” backgrounds show their names again.'
    ]
  },
  {
    version: '1.0.1',
    date: '2026-10-05',
    ru: [
      'Листание по голосу слушает вход без «улучшателей» звонков, само находит USB-интерфейс вроде Behringer UCA222, выбирает левый или правый канал и выравнивает громкость.',
      'Звук читается прямо со входа и не теряется, если компьютер на миг притормозил; слайд меняется примерно через 0,3–0,4 с после начала последнего слова.',
      'Кнопка «Проверить звук» показывает уровень по каналам, перегруз, пропуски звука и то, что слышно, не трогая слайды. Слайд можно менять «на слово раньше».',
      'Номера в категории больше не повторяются: новые песни встают в конец и нумеруются дальше, а старые повторы исправляются сами.',
      'Тексты сохраняются сами — при наборе, при переходе на другую вкладку или заготовку и при выходе.',
      'В полях ввода правая кнопка открывает меню «Вырезать, Копировать, Вставить, Выделить всё»; песни без категории прокручиваются вместе с категориями.'
    ],
    en: [
      'Turning slides by voice listens to the input without call “enhancers”, finds a USB interface such as Behringer UCA222 by itself, picks the left or right channel and evens out the volume.',
      'Sound is read straight from the input and is not lost when the computer stalls for a moment; the slide turns about 0.3–0.4 s after the last word begins.',
      '“Check sound” shows the level per channel, overload, dropouts and what is heard without touching the slides. Slides can turn “one word earlier”.',
      'Numbers within a category no longer repeat: new songs go to the end and continue the numbering, and old repeats are fixed automatically.',
      'Texts save themselves — while typing, when switching to another tab or preset, and on exit.',
      'Right-click in a text field opens “Cut, Copy, Paste, Select all”; songs without a category scroll together with the categories.'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-09-26',
    ru: [
      'Слайды листаются по голосу: следующий включается, когда начинают петь последнее слово текущего. Закраска слов убрана.',
      'У слайда можно задать, сколько раз его поют подряд, — переход будет только после последнего раза.',
      'Распознавание понимает слова с «ё» и без неё и не теряет их; начинает слушать вдвое быстрее.',
      'Каталог слился с библиотекой: категории стоят списком под поиском, щелчок открывает категорию, «Назад» возвращает к списку.',
      'Импорт берёт номер и название из имени файла, поэтому порядок песен совпадает с папкой, а старый .ppt разбирается так же, как .pptx.',
      'Текст на проекторе раскладывается так же, как в окне программы, при любом шрифте и масштабе экрана.'
    ],
    en: [
      'Slides turn by voice: the next one comes up as the last word of the current one begins. Word colouring is gone.',
      'A slide can be set to be sung several times in a row — it turns only after the last time.',
      'Recognition understands words with and without “ё” and no longer loses them; it starts listening twice as fast.',
      'The catalogue merged into the library: categories stand in a list under the search, a click opens a category, “Back” returns to the list.',
      'Import takes the number and the title from the file name, so the order of songs matches the folder, and an old .ppt is read the same way as .pptx.',
      'Text on the projector is laid out exactly as in the program window, with any font and any screen scaling.'
    ]
  },
  {
    version: '0.4.2',
    date: '2026-09-18',
    ru: [
      'Фон из PowerPoint переносится точно: рисует его сам PowerPoint, поэтому остаются волны, градиенты и цвета темы, а не одна заливка.',
      'Цвет текста подстраивается под такой фон: на светлой теме буквы становятся тёмными.',
      'Уведомления гаснут сами: обычные через несколько секунд, сообщения об ошибке — дольше.'
    ],
    en: [
      'The PowerPoint background comes across exactly: PowerPoint itself draws it, so the waves, gradients and theme colours stay instead of a single fill.',
      'The text colour follows that background: on a light theme the letters turn dark.',
      'Notices fade away by themselves: ordinary ones after a few seconds, error messages after longer.'
    ]
  },
  {
    version: '0.4.1',
    date: '2026-09-17',
    ru: [
      'Караоке красит каждую строку своим цветом: на пёстром фоне верхние строки и нижние больше не сливаются.',
      'Цвет караоке выбирается так же, как цвет текста: палитрой с ползунком, полем кода и кнопкой «под фон».',
      'В наборе цветов караоке появились тёмные — для светлых фонов и фотографий.',
      'История обновлений здесь стала короче.'
    ],
    en: [
      'Karaoke colours every line on its own: on a busy background the top and bottom lines no longer blend in.',
      'The karaoke colour is chosen the same way as the text colour: a palette with a slider, a code field and a “to background” button.',
      'The karaoke colour set now has dark colours too — for light backgrounds and photographs.',
      'This list of changes is shorter now.'
    ]
  },
  {
    version: '0.4.0',
    date: '2026-09-14',
    ru: [
      'Каталог песен: общий сборник общины со своими вкладками, поиском и защитой от повторов.',
      'Умный импорт: одинаковые слайды сами становятся припевом, фон презентации ложится в галерею фонов.',
      'Номер задаёт место песни в библиотеке; порядок меняется и мышью.',
      'Пульт листает то, что на экране, и работает, даже когда программа свёрнута.',
      'На «Главной» — кнопки подключённых мониторов: предпросмотр принимает пропорции выбранного экрана.',
      'Караоке само подбирает цвет закраски под фон.',
      'Презентация, ставшая песней, уходит из плана; песней становится и старый .ppt.'
    ],
    en: [
      'Song catalogue: the church songbook with its own tabs, search and protection from duplicates.',
      'Smarter import: identical slides become the chorus by themselves, and the presentation background goes into the background gallery.',
      'The number sets a song’s place in the library; the order can also be changed with the mouse.',
      'The remote steps what is on screen and works even when the app is minimised.',
      'Buttons for the connected monitors on the Home tab: the preview takes the shape of the chosen screen.',
      'Karaoke chooses its fill colour for the background by itself.',
      'A presentation turned into a song leaves the plan; an old .ppt can become a song too.'
    ]
  },
  {
    version: '0.3.0',
    date: '2026-09-07',
    ru: [
      'Пульт проповедника: программа слушает кнопки презентера.',
      'Показ можно сделать песней — с текстом по частям и фоном презентации.',
      'Книги Библии стоят в одном порядке во всех переводах, неканонические — отдельным списком.',
      'Караоке закрашивает слово по букве, а не заливает целиком.',
      'Поля ввода растут под текст: список нужд виден целиком.'
    ],
    en: [
      'Presenter remote: the program listens to the buttons of a presenter.',
      'A show can become a song — with the words split into parts and the background kept.',
      'The books of the Bible stand in one order in every translation; the non-canonical ones have a list of their own.',
      'Karaoke fills a word letter by letter instead of washing it with colour.',
      'Text fields grow with what is in them: the whole list of needs is visible.'
    ]
  },
  {
    version: '0.2.4',
    date: '2026-08-31',
    ru: [
      'Ctrl+Z отменяет последнее действие по всей программе, Ctrl+Shift+Z возвращает.',
      'Караоке идёт за пением само: программа слушает зал и узнаёт слова этой песни.',
      'Для слуха один раз ставится голосовой модуль — кнопкой или с флешки.'
    ],
    en: [
      'Ctrl+Z undoes the last action anywhere in the program, Ctrl+Shift+Z brings it back.',
      'Karaoke follows the singing by itself: the program listens to the hall and recognises the words of the song.',
      'A voice module is installed once — by a button or from a flash drive.'
    ]
  },
  {
    version: '0.2.3',
    date: '2026-08-31',
    ru: [
      'Текст занимает весь экран, а размер выбирается привычными числами, как в Word.',
      'Текст режется на слайды под тот экран, который стоит в зале.',
      'Презентации больше не искажаются: кадр берётся из самой презентации.',
      'Песни из PowerPoint приходят куплетами; читается и старый .ppt.'
    ],
    en: [
      'Text fills the whole screen, and its size is chosen in familiar numbers, like in Word.',
      'Text is split into slides for the screen actually standing in the hall.',
      'Presentations are no longer distorted: the frame comes from the presentation itself.',
      'Songs from PowerPoint arrive as verses; the old .ppt is read as well.'
    ]
  },
  {
    version: '0.2.2',
    date: '2026-08-29',
    ru: [
      'Обновление доводится до конца: установщик переживает закрытие программы.',
      'Тексты выгружаются в файл — текстом, в PDF или в PowerPoint.',
      'Свой формат перевода: один файл .vlb вместо папки с сотней файлов.'
    ],
    en: [
      'Updating finishes the job: the installer outlives the program.',
      'Texts can be exported to a file — as plain text, PDF or PowerPoint.',
      'Our own translation format: a single .vlb file instead of a folder with a hundred files.'
    ]
  },
  {
    version: '0.2.1',
    date: '2026-08-28',
    ru: [
      'Обновление одной кнопкой: программа скачает новую версию и поставит её сама.',
      'Модули с сайта читаются и у тех, у кого включён VPN или прокси.'
    ],
    en: [
      'Updating with one button: the program downloads the new version and installs it itself.',
      'Modules from the site load for people behind a VPN or proxy too.'
    ]
  },
  {
    version: '0.2.0',
    date: '2026-08-27',
    ru: [
      'Фотографии в служении: снимки с компьютера встают в план одним показом.',
      'Папку можно добавить целиком — каждая презентация в ней станет своим пунктом.',
      'Большие снимки ужимаются до кадра проектора.'
    ],
    en: [
      'Photos in the service: pictures from the computer become one show in the plan.',
      'A whole folder can be added — every presentation inside becomes its own item.',
      'Large pictures are shrunk to the projector frame.'
    ]
  },
  {
    version: '0.1.0',
    date: '2026-08-26',
    ru: [
      'Первая рабочая версия.',
      'Библия, песни, объявления и чужие презентации — на проектор.',
      'Служение одним списком и кнопкой «Далее».',
      'Экраны: зал, сцена и трансляция, каждый на своём мониторе.',
      'Русский и английский язык, тринадцать стилей оформления.'
    ],
    en: [
      'First working version.',
      'Bible, songs, announcements and presentations made elsewhere — on the projector.',
      'The service as one list and a single “Next” button.',
      'Screens: hall, stage and stream, each on its own monitor.',
      'Russian and English, thirteen interface styles.'
    ]
  }
]

export const releaseNotes = (release: Release): string[] =>
  lang() === 'en' ? release.en : release.ru

export function releaseDate(release: Release): string {
  const [year, month, day] = release.date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(lang(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
