import {
  feed,
  followFrom,
  normalizeWord,
  phrasesOf,
  plainLine,
  tapeOf,
  tokensOf,
  type Follow,
  type Tape,
  type TapeSlide,
  type TapeWord,
  type Utterance
} from '@shared/singAlong'
import { useLive } from './live'
import { useSongs, type SongSlide } from './songs'
import type { SwitchMoment } from '@shared/voiceSound'
import { useVoice } from './voice'

interface Built {
  tape: Tape
  slides: TapeSlide[]
  grammar: string | null
  text: string
  song: string | null
  notes: string[]
}

const textKey = (slides: SongSlide[]): string =>
  slides.map((one) => one.slide.blocks.map((b) => b.html).join('\n')).join('\n\n')

const timesOf = (slides: SongSlide[]): string => slides.map((one) => one.times).join(',')

const moment = (): SwitchMoment => useVoice.getState().moment

const forward = (): boolean => useVoice.getState().forward

const at = (ms: number): string => `${(ms / 1000).toFixed(1)} с`

const note = (line: string): void => window.api.voice.note(line)

const following = (): boolean => {
  const voice = useVoice.getState()
  return voice.on && voice.mode === 'follow'
}

export function startVoiceFollow(): () => void {
  let built: Built | null = null
  let state: Follow | null = null
  let utter: Utterance | null = null
  let expecting = -1
  let generation = 0

  const now = (): number => performance.now()

  const publish = (): void => {
    const mark = state && built ? built.tape.slides[state.slide] : undefined
    const sung = state && mark ? { slide: state.slide, pass: state.pass, times: mark.times } : null
    const was = useVoice.getState().sung
    if (
      was?.slide === sung?.slide &&
      was?.pass === sung?.pass &&
      was?.times === sung?.times
    ) {
      return
    }
    useVoice.setState({ sung })
  }

  async function build(): Promise<Built | null> {
    const my = ++generation
    const { slides, draft } = useSongs.getState()

    const lines = slides.map((one) => one.slide.blocks.map((b) => tokensOf(plainLine(b.html))))
    const tokens = [...new Set(lines.flat(2))]
    const spelled =
      tokens.length > 0 ? await window.api.voice.spell(tokens).catch(() => null) : null
    if (my !== generation) return null

    const parts = (token: string): string[] => (spelled ? (spelled[token] ?? []) : [token])

    const tapeSlides: TapeSlide[] = slides.map((one, index) => ({
      times: one.times,
      lines: lines[index].map((line) =>
        line.flatMap((token): TapeWord[] => {
          const known = parts(token)
          return known.length > 0
            ? known.map((word) => ({ norm: normalizeWord(word), hear: true }))
            : [{ norm: normalizeWord(token), hear: false }]
        })
      )
    }))

    const phrases = lines.flat().map((line) => line.flatMap(parts))

    const missing = tokens.filter((token) => parts(token).length === 0)
    const swapped = tokens.filter((token) => {
      const found = parts(token).join(' ')
      return found !== '' && normalizeWord(found) !== normalizeWord(token)
    })
    const slideLine = (one: SongSlide, index: number): string => {
      const times = one.times > 1 ? ` ×${one.times}` : ''
      const text = one.slide.blocks.map((b) => plainLine(b.html)).join(' / ')
      return `  [${index + 1}]${times} ${text}`
    }
    const notes = [
      `песня: ${draft?.title ?? '—'} · слайдов: ${slides.length}`,
      ...slides.map(slideLine),
      missing.length ? `  модуль не знает: ${missing.join(', ')}` : '',
      swapped.length
        ? `  слышит как: ${swapped.map((one) => `${one} → ${parts(one).join(' ')}`).join(', ')}`
        : ''
    ].filter(Boolean)

    return {
      tape: tapeOf(tapeSlides, moment(), forward()),
      slides: tapeSlides,
      grammar: phrases.some((one) => one.length > 0) ? phrasesOf(phrases) : null,
      text: textKey(slides),
      song: draft?.id ?? null,
      notes
    }
  }

  function restart(index: number): void {
    if (!built) return
    state = followFrom(built.tape, index, now())
    utter = null
    publish()
  }

  async function refresh(): Promise<string | null> {
    const next = await build()
    if (!next) return built?.grammar ?? null

    built = next
    for (const line of next.notes) note(line)
    expecting = -1
    restart(useSongs.getState().index)

    await useVoice.getState().setGrammar(next.grammar)
    return next.grammar
  }

  function retime(slides: TapeSlide[]): void {
    if (!built) return
    built = { ...built, slides, tape: tapeOf(slides, moment(), forward()) }
    publish()
  }

  async function go(to: number): Promise<void> {
    const songs = useSongs.getState()
    if (to === songs.index || to < 0 || to >= songs.slides.length) return

    expecting = to
    const live = useLive.getState().live.slide
    const draft = songs.draft
    const ours = live !== null && draft !== null && live.id.startsWith(`song-${draft.id}-`)

    if (ours) await songs.goTo(to)
    else useSongs.setState({ index: to })
  }

  useVoice.setState({ prepare: refresh })

  const offSongs = useSongs.subscribe((after, before) => {
    if (!useVoice.getState().on) return

    if (after.draft?.id !== before.draft?.id || after.slides !== before.slides) {
      const text = textKey(after.slides)
      if (!built || built.song !== (after.draft?.id ?? null) || built.text !== text) {
        void refresh()
        return
      }
      if (!following()) return
      const sameCount = built.slides.length === after.slides.length
      if (sameCount && timesOf(after.slides) !== built.slides.map((one) => one.times).join(',')) {
        retime(built.slides.map((one, i) => ({ ...one, times: after.slides[i].times })))
      }
    }

    if (after.index !== before.index && following()) {
      if (after.index === expecting) {
        expecting = -1
        return
      }
      note(`оператор: слайд ${after.index + 1}`)
      restart(after.index)
    }
  })

  const offHeard = window.api.voice.onHeard((heard) => {
    const { text, final } = heard
    if (final) {
      const sure = heard.conf !== undefined ? ` (${heard.conf.toFixed(2)})` : ''
      note(`${at(heard.at)} = ${text}${sure}`)
    }
    if (!following() || !built || !state) {
      utter = null
      return
    }

    const result = feed(built.tape, state, utter, text, now())
    state = result.state
    utter = final ? null : result.utter
    publish()

    for (const step of result.steps) {
      if (step.kind !== 'again') continue
      note(`${at(heard.at)} >>> повтор ${step.pass + 1} («${text}»)`)
    }
    for (const step of [...result.steps].reverse()) {
      if (step.kind === 'turn' || step.kind === 'jump') {
        const how = step.kind === 'jump' ? ' (прыжок)' : ''
        note(`${at(heard.at)} >>> слайд ${step.to + 1}${how} («${text}»)`)
        void go(step.to)
        break
      }
    }
  })

  const offVoice = useVoice.subscribe((after, before) => {
    if ((after.moment !== before.moment || after.forward !== before.forward) && built) retime(built.slides)

    if (after.on === before.on && after.mode === before.mode) return
    utter = null
    expecting = -1
    if (!after.on || after.mode !== 'follow') {
      state = null
      publish()
    }
  })

  return () => {
    offSongs()
    offHeard()
    offVoice()
    useVoice.setState({ prepare: null })
  }
}
