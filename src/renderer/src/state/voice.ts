import { create } from 'zustand'
import {
  DEFAULT_TUNING,
  cleanMoment,
  cleanTuning,
  type SwitchMoment,
  type VoiceMeter,
  type VoiceStatus,
  type VoiceTuning
} from '@shared/voiceSound'

export interface VoiceModel {
  installed: boolean
  bytes: number
}

export interface VoiceStep {
  stage: 'ask' | 'download' | 'save' | 'done'
  got?: number
  total?: number
}

export interface Sung {
  slide: number

  pass: number
  times: number
}

export type VoiceMode = 'follow' | 'check'

const HEARD_EVERY = 125

const WINDOWS_ALIASES = new Set(['default', 'communications'])

const NOTE_METER_MS = 5000

const at = (ms: number | undefined): string => `${((ms ?? 0) / 1000).toFixed(1)} с`

const meterLine = (meter: VoiceMeter): string =>
  [
    `${at(meter.at)} звук`,
    `L ${Math.round(meter.left)}`,
    meter.channels > 1 ? `R ${Math.round(meter.right)}` : '',
    `канал ${meter.use}`,
    `усиление ${meter.gainDb}`,
    meter.open ? 'голос' : 'тишина',
    meter.clip ? 'ПЕРЕГРУЗ' : '',
    meter.lost ? `потеряно ${meter.lost} мс` : ''
  ]
    .filter(Boolean)
    .join(' · ')

interface VoiceStore {
  model: VoiceModel | null

  step: VoiceStep | null
  busy: boolean
  error: string | null
  status: VoiceStatus
  devices: { id: string; label: string }[]
  deviceId: string | null

  heard: string
  lag: number | null
  meter: VoiceMeter | null

  grammar: string | null
  on: boolean
  mode: VoiceMode
  tuning: VoiceTuning
  moment: SwitchMoment
  forward: boolean
  record: boolean

  sung: Sung | null

  prepare: (() => Promise<string | null>) | null

  init: () => Promise<void>
  install: () => Promise<void>
  installFile: () => Promise<void>
  setDevice: (id: string | null) => void
  listen: (on: boolean, mode?: VoiceMode) => Promise<void>
  toggle: () => Promise<void>
  check: () => Promise<void>
  setGrammar: (grammar: string | null) => Promise<void>
  setTuning: (patch: Partial<VoiceTuning>) => void
  setMoment: (moment: SwitchMoment) => void
  setForward: (forward: boolean) => void
  setRecord: (record: boolean) => void
}

export const useVoice = create<VoiceStore>((set, get) => ({
  model: null,
  step: null,
  busy: false,
  error: null,
  status: { state: 'off' },
  devices: [],
  deviceId: null,
  heard: '',
  lag: null,
  meter: null,
  grammar: null,
  on: false,
  mode: 'follow',
  tuning: DEFAULT_TUNING,
  moment: 'last',
  forward: false,
  record: false,
  sung: null,
  prepare: null,

  init: async () => {
    const [model, saved] = await Promise.all([
      window.api.voice.model(),
      window.api.settings.all()
    ])

    const device = typeof saved.voiceDevice === 'string' ? saved.voiceDevice : null
    set({
      model,
      deviceId: device && !WINDOWS_ALIASES.has(device) ? device : null,
      tuning: cleanTuning(saved.voiceTuning),
      moment: cleanMoment(saved.voiceMoment),
      forward: saved.voiceForward === true,
      record: saved.voiceRecord === true
    })

    let noted = 0

    window.api.voice.onStatus((status) => {
      const { meter, devices, ...rest } = status
      const was = get().status as unknown as Record<string, unknown>
      const changed = Object.entries(rest).some(([key, value]) => was[key] !== value)

      if (changed && rest.state && rest.state !== was.state) {
        window.api.voice.note(
          [
            `--- ${rest.state}`,
            rest.using ? `вход: ${rest.using}` : '',
            rest.channels ? `каналов: ${rest.channels}` : '',
            rest.error ? `ошибка: ${rest.error}` : ''
          ]
            .filter(Boolean)
            .join(' · ')
        )
      }
      if (meter && Date.now() - noted >= NOTE_METER_MS) {
        noted = Date.now()
        window.api.voice.note(meterLine(meter))
      }

      set({
        ...(changed ? { status: { ...get().status, ...rest } } : {}),
        ...(meter ? { meter } : {}),
        ...(devices ? { devices } : {}),
        ...(status.state === 'error'
          ? { on: false, meter: null, error: status.error ?? null }
          : {}),
        ...(status.state === 'listening' ? { error: null } : {})
      })
    })

    let latest = { text: '', lag: 0 }
    let waiting: ReturnType<typeof setTimeout> | null = null
    window.api.voice.onHeard(({ text, lag }) => {
      latest = { text, lag }
      waiting ??= setTimeout(() => {
        waiting = null
        if (!get().on) return
        set({
          ...(latest.text !== get().heard ? { heard: latest.text } : {}),
          lag: Math.round(latest.lag / 10) * 10
        })
      }, HEARD_EVERY)
    })
    window.api.voice.onInstallStep((step) => set({ step }))
  },

  install: async () => {
    set({ busy: true, error: null, step: { stage: 'ask' } })
    try {
      set({ model: await window.api.voice.install() })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      set({ busy: false, step: null })
    }
  },

  installFile: async () => {
    set({ busy: true, error: null })
    try {
      const model = await window.api.voice.installFile()
      if (model) set({ model })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      set({ busy: false })
    }
  },

  setDevice: (id) => {
    set({ deviceId: id })
    void window.api.settings.set('voiceDevice', id)

    if (get().on) void get().listen(true, get().mode)
  },

  listen: async (on, mode = 'follow') => {
    if (!on) {
      set({ on: false, error: null, heard: '', lag: null, meter: null, sung: null })
      await window.api.voice.command({ do: 'stop' })
      set({ status: { state: 'off' } })
      return
    }

    set({ on: true, mode, error: null, heard: '', lag: null, sung: null })
    await window.api.voice.command({
      do: 'start',
      deviceId: get().deviceId,
      grammar: get().grammar,
      tuning: get().tuning,
      record: get().record
    })
    window.api.voice.note(
      [
        `режим: ${mode === 'follow' ? 'листание' : 'проверка звука'}`,
        `вход: ${get().deviceId ?? 'авто'}`,
        `настройка: ${JSON.stringify(get().tuning)}`,
        `смена: ${get().moment}`,
        `только вперёд: ${get().forward ? 'да' : 'нет'}`
      ].join(' · ')
    )

    const prepare = get().prepare
    if (prepare && get().on) await prepare()
  },

  toggle: () =>
    get().on && get().mode === 'follow' ? get().listen(false) : get().listen(true, 'follow'),

  check: () =>
    get().on && get().mode === 'check' ? get().listen(false) : get().listen(true, 'check'),

  setGrammar: async (grammar) => {
    if (grammar === get().grammar) return
    set({ grammar })
    if (!get().on) return

    await window.api.voice.command({ do: 'grammar', grammar })
  },

  setTuning: (patch) => {
    const tuning = cleanTuning({ ...get().tuning, ...patch })
    set({ tuning })
    void window.api.settings.set('voiceTuning', tuning)
    if (get().on) void window.api.voice.command({ do: 'tune', tuning })
  },

  setMoment: (moment) => {
    set({ moment })
    void window.api.settings.set('voiceMoment', moment)
  },

  setForward: (forward) => {
    set({ forward })
    void window.api.settings.set('voiceForward', forward)
  },

  setRecord: (record) => {
    set({ record })
    void window.api.settings.set('voiceRecord', record)
    if (get().on) void get().listen(true, get().mode)
  }
}))
