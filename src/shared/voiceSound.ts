export type VoiceChannel = 'auto' | 'both' | 'left' | 'right'

export type ChannelUse = 'both' | 'left' | 'right'

export type SwitchMoment = 'last' | 'early'

export interface VoiceTuning {
  channel: VoiceChannel
  autoGain: boolean
  gainDb: number
  gateDb: number
}

export const DEFAULT_TUNING: VoiceTuning = {
  channel: 'auto',
  autoGain: true,
  gainDb: 0,
  gateDb: -60
}

export const GAIN_DB = { min: -12, max: 30 }
export const GATE_DB = { min: -80, max: -30 }

export interface VoiceMeter {
  channels: number
  left: number
  right: number
  peak: number
  clip: boolean
  open: boolean
  gainDb: number
  use: ChannelUse
  at?: number
  lost?: number
  vosk?: VoskCounts
}

export interface VoskCounts {
  results: number
  empty: number
  partials: number
}

const TAPS = 95
const PASS_SHARE = 0.4375

export class Resampler {
  private readonly step: number
  private readonly taps: Float64Array
  private history: Float32Array
  private at = 0

  constructor(from: number, to: number) {
    this.step = from / to
    const cutoff = (Math.min(from, to) * PASS_SHARE) / from
    const middle = (TAPS - 1) / 2
    const taps = new Float64Array(TAPS)
    let sum = 0
    for (let k = 0; k < TAPS; k++) {
      const x = k - middle
      const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)
      const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * k) / (TAPS - 1))
      taps[k] = sinc * window
      sum += taps[k]
    }
    for (let k = 0; k < TAPS; k++) taps[k] /= sum
    this.taps = taps
    this.history = new Float32Array(TAPS)
  }

  push(input: Float32Array): Float32Array {
    const keep = TAPS
    const all = new Float32Array(keep + input.length)
    all.set(this.history)
    all.set(input, keep)

    const filtered = (i: number): number => {
      let y = 0
      for (let k = 0; k < TAPS; k++) y += this.taps[k] * all[i - k]
      return y
    }

    const out: number[] = []
    while (this.at + 1 < input.length) {
      const i = Math.floor(this.at)
      const part = this.at - i
      const a = filtered(i + keep)
      out.push(part > 1e-9 ? a + (filtered(i + keep + 1) - a) * part : a)
      this.at += this.step
    }
    this.at -= input.length
    this.history = all.slice(all.length - keep)
    return Float32Array.from(out)
  }
}

export interface VoiceHeard {
  text: string
  final: boolean
  at: number
  lag: number
  conf?: number
}

export interface VoiceStatus {
  state: string
  error?: string
  using?: string
  auto?: boolean
  channels?: number
  meter?: VoiceMeter
  devices?: { id: string; label: string }[]
}

export interface VoiceCommand {
  do: 'start' | 'stop' | 'devices' | 'grammar' | 'tune'
  deviceId?: string | null
  grammar?: string | null
  tuning?: VoiceTuning
  record?: boolean
}

const CHANNELS: VoiceChannel[] = ['auto', 'both', 'left', 'right']

const within = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(Math.min(max, Math.max(min, value)))
    : fallback

export function cleanTuning(value: unknown): VoiceTuning {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    channel: CHANNELS.includes(raw.channel as VoiceChannel)
      ? (raw.channel as VoiceChannel)
      : DEFAULT_TUNING.channel,
    autoGain: typeof raw.autoGain === 'boolean' ? raw.autoGain : DEFAULT_TUNING.autoGain,
    gainDb: within(raw.gainDb, GAIN_DB.min, GAIN_DB.max, DEFAULT_TUNING.gainDb),
    gateDb: within(raw.gateDb, GATE_DB.min, GATE_DB.max, DEFAULT_TUNING.gateDb)
  }
}

export const cleanMoment = (value: unknown): SwitchMoment => (value === 'early' ? 'early' : 'last')

export const SILENT_DB = -100

export const toDb = (power: number): number =>
  power > 1e-10 ? Math.max(SILENT_DB, 10 * Math.log10(power)) : SILENT_DB

export const ampOf = (db: number): number => 10 ** (db / 20)

const powerOf = (db: number): number => 10 ** (db / 10)

const HIGH_PASS_HZ = 150
const CEILING = 0.89
const RELEASE_S = 0.08
const TARGET_DB = -20
const AUTO_GAIN = { min: -6, max: 24 }
const RISE_DB_PER_S = 4
const FALL_DB_PER_S = 12
const HOLD_S = 0.35
const SHUT = ampOf(-40)
const OPEN_S = 0.005
const CLOSE_S = 0.06
const FAST_S = 0.02
const LEVEL_S = 0.8
const PICK_AVERAGE_S = 1.5
const PICK_AFTER_S = 1
const PICK_MARGIN_DB = 4
const CLIP = 0.99

export function pickChannel(left: number, right: number, mix: number): ChannelUse {
  const best = Math.max(left, right)
  if (best <= 0) return 'both'
  if (toDb(best) - toDb(mix) >= PICK_MARGIN_DB) return left >= right ? 'left' : 'right'
  return 'both'
}

class HighPass {
  private readonly b0: number
  private readonly b1: number
  private readonly b2: number
  private readonly a1: number
  private readonly a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(rate: number, hz: number) {
    const w = (2 * Math.PI * hz) / rate
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / Math.SQRT2
    const a0 = 1 + alpha
    this.b0 = (1 + cos) / 2 / a0
    this.b1 = -(1 + cos) / a0
    this.b2 = (1 + cos) / 2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }

  step(x: number): number {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

const smoothing = (rate: number, seconds: number): number => 1 - Math.exp(-1 / (rate * seconds))

export class VoiceShaper {
  private tuning: VoiceTuning
  private readonly rate: number
  private readonly left: HighPass[]
  private readonly right: HighPass[]
  private readonly releaseK: number
  private envelope = 0
  private readonly fastK: number
  private readonly levelK: number
  private readonly openK: number
  private readonly closeK: number

  private channels = 1
  private use: ChannelUse = 'both'
  private wanted: ChannelUse = 'both'
  private wantedFor = 0
  private powerLeft = 0
  private powerRight = 0
  private powerMix = 0

  private fast = 0
  private level = 0
  private open = false
  private quietFor = 0
  private gate = SHUT
  private gainDb = 0
  private gain = 1

  private sumLeft = 0
  private sumRight = 0
  private count = 0
  private peak = 0
  private clips = 0
  private wasOpen = false

  constructor(rate: number, tuning: VoiceTuning = DEFAULT_TUNING) {
    this.rate = rate
    this.left = [new HighPass(rate, HIGH_PASS_HZ), new HighPass(rate, HIGH_PASS_HZ)]
    this.right = [new HighPass(rate, HIGH_PASS_HZ), new HighPass(rate, HIGH_PASS_HZ)]
    this.releaseK = Math.exp(-1 / (rate * RELEASE_S))
    this.fastK = smoothing(rate, FAST_S)
    this.levelK = smoothing(rate, LEVEL_S)
    this.openK = smoothing(rate, OPEN_S)
    this.closeK = smoothing(rate, CLOSE_S)
    this.tuning = cleanTuning(tuning)
    this.tune(this.tuning)
  }

  tune(tuning: VoiceTuning): void {
    this.tuning = cleanTuning(tuning)
    if (!this.tuning.autoGain) this.setGain(this.tuning.gainDb)
    if (this.tuning.channel !== 'auto') this.use = this.tuning.channel
  }

  private setGain(db: number): void {
    this.gainDb = db
    this.gain = ampOf(db)
  }

  process(left: Float32Array, right: Float32Array | null, out: Float32Array): void {
    const n = left.length
    const stereo = right !== null && right.length === n
    this.channels = stereo ? 2 : 1
    if (!stereo) this.use = 'left'

    const gatePower = powerOf(this.tuning.gateDb)
    const holdFrames = HOLD_S * this.rate
    const use = this.use
    let blockLeft = 0
    let blockRight = 0
    let blockMix = 0

    for (let i = 0; i < n; i++) {
      const rawLeft = left[i]
      const rawRight = stereo ? right[i] : rawLeft
      const top = Math.max(Math.abs(rawLeft), Math.abs(rawRight))
      if (top > this.peak) this.peak = top
      if (top >= CLIP) this.clips++

      const l = this.left[1].step(this.left[0].step(rawLeft))
      const r = stereo ? this.right[1].step(this.right[0].step(rawRight)) : l
      const mix = (l + r) / 2
      blockLeft += l * l
      blockRight += r * r
      blockMix += mix * mix

      const x = use === 'left' ? l : use === 'right' ? r : mix
      const power = x * x
      this.fast += (power - this.fast) * this.fastK

      if (this.fast > gatePower) {
        this.open = true
        this.quietFor = 0
      } else if (this.open && ++this.quietFor > holdFrames) {
        this.open = false
      }
      if (this.open) {
        this.wasOpen = true
        this.level += (power - this.level) * this.levelK
      }

      this.gate += ((this.open ? 1 : SHUT) - this.gate) * (this.open ? this.openK : this.closeK)
      const y = x * this.gate * this.gain
      const size = Math.abs(y)
      this.envelope = size > this.envelope ? size : this.envelope * this.releaseK
      out[i] = this.envelope > CEILING ? (y * CEILING) / this.envelope : y
    }

    this.sumLeft += blockLeft
    this.sumRight += blockRight
    this.count += n

    const seconds = n / this.rate
    const k = 1 - Math.exp(-seconds / PICK_AVERAGE_S)
    this.powerLeft += (blockLeft / n - this.powerLeft) * k
    this.powerRight += (blockRight / n - this.powerRight) * k
    this.powerMix += (blockMix / n - this.powerMix) * k

    if (stereo && this.tuning.channel === 'auto') this.pick(seconds, gatePower)
    if (this.tuning.autoGain && this.open && this.level > 0) this.follow(seconds)
  }

  private pick(seconds: number, gatePower: number): void {
    if (Math.max(this.powerLeft, this.powerRight) <= gatePower) {
      this.wantedFor = 0
      return
    }

    const wanted = pickChannel(this.powerLeft, this.powerRight, this.powerMix)
    if (wanted === this.use) {
      this.wantedFor = 0
      return
    }
    if (wanted !== this.wanted) {
      this.wanted = wanted
      this.wantedFor = 0
    }
    this.wantedFor += seconds
    if (this.wantedFor >= PICK_AFTER_S) {
      this.use = wanted
      this.wantedFor = 0
    }
  }

  private follow(seconds: number): void {
    const wanted = Math.min(
      AUTO_GAIN.max,
      Math.max(AUTO_GAIN.min, TARGET_DB - toDb(this.level))
    )
    const step = wanted - this.gainDb
    const limit = (step > 0 ? RISE_DB_PER_S : FALL_DB_PER_S) * seconds
    this.setGain(this.gainDb + Math.max(-limit, Math.min(limit, step)))
  }

  meter(): VoiceMeter {
    const count = Math.max(1, this.count)
    const meter: VoiceMeter = {
      channels: this.channels,
      left: toDb(this.sumLeft / count),
      right: this.channels > 1 ? toDb(this.sumRight / count) : SILENT_DB,
      peak: toDb(this.peak * this.peak),
      clip: this.clips > 0,
      open: this.wasOpen || this.open,
      gainDb: Math.round(this.gainDb * 10) / 10,
      use: this.use
    }
    this.sumLeft = 0
    this.sumRight = 0
    this.count = 0
    this.peak = 0
    this.clips = 0
    this.wasOpen = false
    return meter
  }
}
