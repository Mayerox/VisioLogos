import { createModel, type Model, type KaldiRecognizer } from 'vosk-browser'
import {
  DEFAULT_TUNING,
  Resampler,
  VoiceShaper,
  cleanTuning,
  type VoiceCommand,
  type VoiceStatus,
  type VoiceTuning
} from '@shared/voiceSound'

declare class MediaStreamTrackProcessor<T> {
  constructor(init: { track: MediaStreamTrack; maxBufferSize?: number })
  readonly readable: ReadableStream<T>
}

const RATE = 16_000

const CHUNK = 512

const METER_EVERY = 1280

const QUEUE = 300

const GAP_US = 2000

const SOUND_EVERY = RATE * 2

const MODEL_URL = 'visio://voice/model.zip'

const INTERFACE = /usb audio codec|behringer|u-control|uca\s?\d{3}/i

const SKIP_IDS = new Set(['default', 'communications'])

const log = (line: string): void => {
  const box = document.getElementById('log')
  if (box) box.textContent = `${line}\n${box.textContent ?? ''}`.slice(0, 4000)
}

interface Listening {
  recognizer: KaldiRecognizer
  fed: { at: number; sent: number }[]
}

interface Sound {
  rate: number
  channels: number
  left: Resampler
  right: Resampler | null
  shaper: VoiceShaper
  planeLeft: Float32Array
  planeRight: Float32Array
  chunk: Float32Array
  filled: number
  made: number
  sinceMeter: number
  next: number | null
  lost: number
}

let model: Model | null = null
let ear: Listening | null = null
let stream: MediaStream | null = null
let reader: ReadableStreamDefaultReader<AudioData> | null = null
let sound: Sound | null = null
let generation = 0

let told = 'off'
let grammarNow: string | null = null
let tuning: VoiceTuning = DEFAULT_TUNING
let recording = false
let tape = new Int16Array(SOUND_EVERY)
let taped = 0

function say(status: VoiceStatus): void {
  if (status.state !== told) log(status.state + (status.error ? `: ${status.error}` : ''))
  told = status.state
  window.api.voice.status(status)
}

async function inputs(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter((one) => one.kind === 'audioinput')
}

async function labelled(): Promise<MediaDeviceInfo[]> {
  const list = await inputs()
  if (list.length === 0 || list.some((one) => one.label)) return list

  const probe = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
  probe?.getTracks().forEach((track) => track.stop())
  return inputs()
}

async function devices(): Promise<void> {
  try {
    const list = (await inputs())
      .filter((one) => !SKIP_IDS.has(one.deviceId))
      .map((one, i) => ({ id: one.deviceId, label: one.label || `Вход ${i + 1}` }))
    window.api.voice.status({ state: told, devices: list })
  } catch (error) {
    say({ state: 'error', error: String(error) })
  }
}

async function interfaceInput(): Promise<string | null> {
  const found = (await labelled()).find(
    (one) => !SKIP_IDS.has(one.deviceId) && INTERFACE.test(one.label)
  )
  return found?.deviceId ?? null
}

async function start(
  deviceId?: string | null,
  grammar?: string | null,
  wanted?: VoiceTuning,
  record?: boolean
): Promise<void> {
  grammarNow = grammar ?? null
  tuning = cleanTuning(wanted ?? tuning)
  await stop()
  recording = Boolean(record)
  const my = ++generation
  say({ state: 'loading' })

  try {
    model ??= await createModel(MODEL_URL)
    ear = listenWith(grammarNow)

    const picked = deviceId ?? (await interfaceInput())
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(picked ? { deviceId: { exact: picked } } : {}),
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })

    const track = stream.getAudioTracks()[0]
    if (!track) throw new Error('вход звука не найден')
    const settings = track.getSettings()

    const processor = new MediaStreamTrackProcessor<AudioData>({ track, maxBufferSize: QUEUE })
    reader = processor.readable.getReader()
    void pump(reader, my)

    say({
      state: 'listening',
      using: track.label,
      auto: !deviceId && picked !== null,
      channels: settings.channelCount ?? 1
    })
    await devices()
  } catch (error) {
    await stop()
    say({ state: 'error', error: reason(error) })
  }
}

async function pump(from: ReadableStreamDefaultReader<AudioData>, my: number): Promise<void> {
  try {
    for (;;) {
      const { value, done } = await from.read()
      if (done || !value) break
      try {
        if (my === generation) take(value)
      } finally {
        value.close()
      }
    }
  } catch {
    return
  }
  if (my === generation) {
    await stop()
    say({ state: 'error', error: 'вход отключён' })
  }
}

function soundFor(data: AudioData): Sound {
  const channels = Math.min(2, data.numberOfChannels)
  if (sound && sound.rate === data.sampleRate && sound.channels === channels) return sound

  const shaper = new VoiceShaper(RATE, tuning)
  sound = {
    rate: data.sampleRate,
    channels,
    left: new Resampler(data.sampleRate, RATE),
    right: channels > 1 ? new Resampler(data.sampleRate, RATE) : null,
    shaper,
    planeLeft: new Float32Array(0),
    planeRight: new Float32Array(0),
    chunk: new Float32Array(CHUNK),
    filled: 0,
    made: 0,
    sinceMeter: 0,
    next: null,
    lost: 0
  }
  return sound
}

function take(data: AudioData): void {
  const one = soundFor(data)
  const n = data.numberOfFrames

  if (one.next !== null && data.timestamp - one.next > GAP_US) {
    one.lost += (data.timestamp - one.next) / 1000
  }
  one.next = data.timestamp + (n / data.sampleRate) * 1_000_000

  if (one.planeLeft.length !== n) {
    one.planeLeft = new Float32Array(n)
    one.planeRight = new Float32Array(n)
  }
  data.copyTo(one.planeLeft, { planeIndex: 0, format: 'f32-planar' })
  if (one.right) data.copyTo(one.planeRight, { planeIndex: 1, format: 'f32-planar' })

  const left = one.left.push(one.planeLeft)
  const right = one.right ? one.right.push(one.planeRight) : null
  const shaped = new Float32Array(left.length)
  one.shaper.process(left, right, shaped)
  if (recording) keepSound(shaped)

  let from = 0
  while (from < shaped.length) {
    const count = Math.min(shaped.length - from, CHUNK - one.filled)
    one.chunk.set(shaped.subarray(from, from + count), one.filled)
    one.filled += count
    one.made += count
    from += count
    if (one.filled === CHUNK) {
      hearChunk(one.chunk, timeOf(one))
      one.chunk = new Float32Array(CHUNK)
      one.filled = 0
    }
  }

  one.sinceMeter += shaped.length
  if (one.sinceMeter >= METER_EVERY) {
    one.sinceMeter = 0
    const meter = one.shaper.meter()
    window.api.voice.status({
      state: told,
      meter: { ...meter, at: timeOf(one), lost: Math.round(one.lost) }
    })
  }
}

function keepSound(samples: Float32Array): void {
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]
    tape[taped++] = v >= 1 ? 32767 : v <= -1 ? -32768 : Math.round(v * 32767)
    if (taped === tape.length) {
      window.api.voice.sound(tape)
      tape = new Int16Array(SOUND_EVERY)
      taped = 0
    }
  }
}

const timeOf = (one: Sound): number => (one.made / RATE) * 1000 + one.lost

function hearChunk(chunk: Float32Array, at: number): void {
  if (!ear) return
  ear.fed.push({ at, sent: performance.now() })
  try {
    ear.recognizer.acceptWaveformFloat(chunk, RATE)
  } catch {
    ear.fed.pop()
  }
}

function listenWith(grammar: string | null): Listening {
  if (!model) throw new Error('модель не загружена')

  const recognizer = grammar
    ? new model.KaldiRecognizer(RATE, grammar)
    : new model.KaldiRecognizer(RATE)
  recognizer.setWords(true)

  const made: Listening = { recognizer, fed: [] }

  const answered = (): { at: number; lag: number } => {
    const one = made.fed.shift()
    return one ? { at: one.at, lag: performance.now() - one.sent } : { at: 0, lag: 0 }
  }

  recognizer.on('partialresult', (message) => {
    const when = answered()
    const result = 'result' in message ? (message.result as { partial?: string }) : null
    if (result?.partial) window.api.voice.heard({ text: result.partial, final: false, ...when })
  })
  recognizer.on('result', (message) => {
    const when = answered()
    const result =
      'result' in message
        ? (message.result as { text?: string; result?: { conf: number }[] })
        : null
    if (!result?.text) return
    const words = result.result ?? []
    const conf = words.length
      ? words.reduce((sum, word) => sum + word.conf, 0) / words.length
      : undefined
    window.api.voice.heard({ text: result.text, final: true, conf, ...when })
  })
  recognizer.on('error', (message) => {
    made.fed = []
    say({ state: 'error', error: String((message as { error?: unknown }).error ?? message) })
  })

  return made
}

async function stop(): Promise<void> {
  generation++
  recording = false
  taped = 0
  const was = reader
  reader = null
  await was?.cancel().catch(() => undefined)

  stream?.getTracks().forEach((track) => track.stop())
  ear?.recognizer.remove()

  ear = null
  stream = null
  sound = null
}

function reason(error: unknown): string {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError') return 'нет доступа к входу звука'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'вход звука не найден'
  if (name === 'NotReadableError') return 'вход звука занят другой программой'
  return error instanceof Error ? error.message : String(error)
}

window.api.voice.onCommand((command: VoiceCommand) => {
  if (command.do === 'start') {
    void start(command.deviceId, command.grammar, command.tuning, command.record)
  } else if (command.do === 'stop') void stop().then(() => say({ state: 'off' }))
  else if (command.do === 'devices') void devices()
  else if (command.do === 'tune') {
    tuning = cleanTuning(command.tuning)
    sound?.shaper.tune(tuning)
  } else if (command.do === 'grammar') {
    grammarNow = command.grammar ?? null
    if (!model || !stream) return
    try {
      ear?.recognizer.remove()
      ear = listenWith(grammarNow)
    } catch (error) {
      say({ state: 'error', error: reason(error) })
    }
  }
})

navigator.mediaDevices.addEventListener('devicechange', () => void devices())

void devices()
