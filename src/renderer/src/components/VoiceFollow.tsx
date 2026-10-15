import type { Key } from '@shared/i18n'
import { weighUpdate } from '@shared/update'
import {
  GAIN_DB,
  GATE_DB,
  SILENT_DB,
  type SwitchMoment,
  type VoiceChannel,
  type VoiceMeter
} from '@shared/voiceSound'
import { Select } from './Select'
import { useT, useTn } from '../state/i18n'
import { MAX_TIMES, useSongs } from '../state/songs'
import { useVoice, type VoiceStep } from '../state/voice'

type T = (key: Key, params?: Record<string, string | number>) => string

const CHANNELS: { value: VoiceChannel; key: Key }[] = [
  { value: 'auto', key: 'voice.chAuto' },
  { value: 'both', key: 'voice.chBoth' },
  { value: 'left', key: 'voice.chLeft' },
  { value: 'right', key: 'voice.chRight' }
]

const MOMENTS: { value: SwitchMoment; key: Key }[] = [
  { value: 'last', key: 'voice.momentLast' },
  { value: 'early', key: 'voice.momentEarly' }
]

const FLOOR_DB = -60

const SLOW_MS = 300

const seconds = (ms: number): string => (Math.max(0, ms) / 1000).toFixed(2).replace('.', ',')

const share = (db: number): number =>
  Math.min(100, Math.max(0, ((db - FLOOR_DB) / -FLOOR_DB) * 100))

export function VoiceFollow(): React.JSX.Element | null {
  const t = useT()
  const tn = useTn()
  const model = useVoice((s) => s.model)
  const busy = useVoice((s) => s.busy)
  const step = useVoice((s) => s.step)
  const error = useVoice((s) => s.error)
  const status = useVoice((s) => s.status)
  const devices = useVoice((s) => s.devices)
  const deviceId = useVoice((s) => s.deviceId)
  const on = useVoice((s) => s.on)
  const mode = useVoice((s) => s.mode)
  const heard = useVoice((s) => s.heard)
  const lag = useVoice((s) => s.lag)
  const meter = useVoice((s) => s.meter)
  const tuning = useVoice((s) => s.tuning)
  const moment = useVoice((s) => s.moment)
  const sung = useVoice((s) => s.sung)
  const record = useVoice((s) => s.record)

  const slides = useSongs((s) => s.slides)
  const index = useSongs((s) => s.index)

  if (!model) return null

  const voice = useVoice.getState()
  const hasSong = slides.length > 0
  const ready = model.installed
  const times = slides[index]?.times ?? 1
  const following = on && mode === 'follow'
  const checking = on && mode === 'check'

  const chosen = devices.find((one) => one.id === deviceId)
  const overAir = /bluetooth|bt\b/i.test(`${chosen?.label ?? ''} ${status.using ?? ''}`)

  const setTimes = (value: number): void => useSongs.getState().setTimes(index, value)

  return (
    <div className="songctl">
      <div className="songctl__head">
        <span>
          {t('voice.panel')}
          <span className="badge voice__beta">{t('voice.beta')}</span>
        </span>
        {on && (
          <b>
            {t(
              status.state === 'loading'
                ? 'voice.loading'
                : checking
                  ? 'voice.checking'
                  : 'voice.listening'
            )}
          </b>
        )}
      </div>

      <p className="voice__beta-note">{t('voice.betaHint')}</p>

      {!ready ? (
        <div className="voice__need">
          <p className="voice__hint">{t('voice.needModel')}</p>
          <div className="control__pair">
            <button className="chip" disabled={busy} onClick={() => void voice.install()}>
              {t('voice.download')}
            </button>

            <button className="chip" disabled={busy} onClick={() => void voice.installFile()}>
              {t('voice.fromDisk')}
            </button>
          </div>
          {step && <p className="voice__step">{stepWord(step, t)}</p>}
        </div>
      ) : (
        <>
          <div className="control__pair">
            <button
              className={`chip voice__listen ${following ? 'is-on' : ''}`}
              disabled={!hasSong && !following}
              title={hasSong ? t('voice.hint') : t('voice.needSong')}
              onClick={() => void voice.toggle()}
            >
              {following ? t('voice.stop') : t('voice.listen')}
            </button>
            <button
              className={`chip ${checking ? 'is-on' : ''}`}
              title={t('voice.checkHint')}
              onClick={() => void voice.check()}
            >
              {checking ? t('voice.checkStop') : t('voice.check')}
            </button>
          </div>

          {hasSong && (
            <div className="voice__times" title={t('voice.timesHint')}>
              <span>{t('voice.times')}</span>
              <button
                className="icon-btn"
                aria-label={t('voice.fewer')}
                disabled={times <= 1}
                onClick={() => setTimes(times - 1)}
              >
                −
              </button>
              <b>{tn('n.times', times)}</b>
              <button
                className="icon-btn"
                aria-label={t('voice.more')}
                disabled={times >= MAX_TIMES}
                onClick={() => setTimes(times + 1)}
              >
                +
              </button>
            </div>
          )}

          {following && sung && sung.slide === index && sung.times > 1 && (
            <p className="voice__step">{t('voice.pass', { n: sung.pass + 1, of: sung.times })}</p>
          )}

          <div className="voice__device">
            <span>{t('voice.device')}</span>
            <Select
              value={deviceId ?? ''}
              onChange={(v) => voice.setDevice(v || null)}
              options={[
                { value: '', label: t('voice.deviceDefault') },
                ...devices.map((one) => ({ value: one.id, label: one.label }))
              ]}
            />
          </div>

          {overAir && <p className="voice__warn">{t('voice.overAir')}</p>}
          {on && status.using && !chosen && (
            <p className="voice__step">
              {t(status.auto ? 'voice.found' : 'voice.using', { name: status.using })}
            </p>
          )}

          <div className="voice__device" title={t('voice.channelHint')}>
            <span>{t('voice.channel')}</span>
            <div className="segmented segmented--4">
              {CHANNELS.map((one) => (
                <button
                  key={one.value}
                  className={tuning.channel === one.value ? 'is-active' : ''}
                  onClick={() => voice.setTuning({ channel: one.value })}
                >
                  {t(one.key)}
                </button>
              ))}
            </div>
          </div>

          {on && meter && <Meter meter={meter} gateDb={tuning.gateDb} t={t} />}
          {on && meter && <MeterNote meter={meter} channel={tuning.channel} t={t} />}

          <details className="voice__more">
            <summary>{t('voice.tune')}</summary>

            <label className="field" title={t('voice.sensitivityHint')}>
              <span className="field__head">
                {t('voice.sensitivity')} <b>{t('voice.gate', { db: tuning.gateDb })}</b>
              </span>
              <input
                type="range"
                min={-GATE_DB.max}
                max={-GATE_DB.min}
                step={1}
                value={-tuning.gateDb}
                onChange={(e) => voice.setTuning({ gateDb: -Number(e.target.value) })}
              />
            </label>

            <label className="checkbox" title={t('voice.autoGainHint')}>
              <input
                type="checkbox"
                checked={tuning.autoGain}
                onChange={(e) => voice.setTuning({ autoGain: e.target.checked })}
              />
              {t('voice.autoGain')}
            </label>

            {!tuning.autoGain && (
              <label className="field">
                <span className="field__head">
                  {t('voice.gain')} <b>{t('voice.db', { db: signed(tuning.gainDb) })}</b>
                </span>
                <input
                  type="range"
                  min={GAIN_DB.min}
                  max={GAIN_DB.max}
                  step={1}
                  value={tuning.gainDb}
                  onChange={(e) => voice.setTuning({ gainDb: Number(e.target.value) })}
                />
              </label>
            )}

            <div className="field" title={t('voice.momentHint')}>
              {t('voice.moment')}
              <div className="segmented segmented--2">
                {MOMENTS.map((one) => (
                  <button
                    key={one.value}
                    className={moment === one.value ? 'is-active' : ''}
                    onClick={() => voice.setMoment(one.value)}
                  >
                    {t(one.key)}
                  </button>
                ))}
              </div>
            </div>

            <label className="checkbox" title={t('voice.recordHint')}>
              <input
                type="checkbox"
                checked={record}
                onChange={(e) => voice.setRecord(e.target.checked)}
              />
              {t('voice.record')}
            </label>
            <button
              className="chip"
              title={t('voice.journalHint')}
              onClick={() => void window.api.voice.openJournal()}
            >
              {t('voice.journal')}
            </button>
          </details>

          {on && heard && <p className="voice__heard">{t('voice.heard', { text: heard })}</p>}
          {on && lag !== null && (checking || lag > SLOW_MS) && (
            <p className={lag > SLOW_MS ? 'voice__warn' : 'voice__step'}>
              {t(lag > SLOW_MS ? 'voice.slow' : 'voice.lag', { s: seconds(lag) })}
            </p>
          )}
        </>
      )}

      {error && <p className="voice__error">{t('voice.failed', { why: error })}</p>}
      {ready && !on && !error && model.bytes > 0 && (
        <p className="voice__step">
          {t('voice.installed', { size: weighUpdate(model.bytes) })}
        </p>
      )}
    </div>
  )
}

function Meter({
  meter,
  gateDb,
  t
}: {
  meter: VoiceMeter
  gateDb: number
  t: T
}): React.JSX.Element {
  const rows: { name: string; db: number; used: boolean }[] =
    meter.channels > 1
      ? [
          { name: t('voice.left'), db: meter.left, used: meter.use !== 'right' },
          { name: t('voice.right'), db: meter.right, used: meter.use !== 'left' }
        ]
      : [{ name: '', db: meter.left, used: true }]

  return (
    <div className="voice__meter" title={t('voice.meterHint')}>
      {rows.map((row) => (
        <div key={row.name} className={`voice__bar ${row.used ? 'is-used' : ''}`}>
          <i>{row.name}</i>
          <span className="voice__track">
            <span
              className={`voice__fill ${meter.clip ? 'is-clip' : ''}`}
              style={{ width: `${share(row.db)}%` }}
            />
            <span className="voice__gate" style={{ left: `${share(gateDb)}%` }} />
          </span>
          <b>{row.db <= SILENT_DB + 1 ? '—' : Math.round(row.db)}</b>
        </div>
      ))}
    </div>
  )
}

function MeterNote({
  meter,
  channel,
  t
}: {
  meter: VoiceMeter
  channel: VoiceChannel
  t: T
}): React.JSX.Element | null {
  if (meter.clip) return <p className="voice__warn">{t('voice.clip')}</p>
  if ((meter.lost ?? 0) >= 500) {
    return <p className="voice__warn">{t('voice.lost', { s: seconds(meter.lost ?? 0) })}</p>
  }
  if (!meter.open) return <p className="voice__step">{t('voice.silent')}</p>
  if (channel === 'auto' && meter.channels > 1 && meter.use !== 'both') {
    const side = meter.use === 'left' ? 'voice.onlyLeft' : 'voice.onlyRight'
    return <p className="voice__step">{t(side)}</p>
  }
  return null
}

const signed = (db: number): string => (db > 0 ? `+${db}` : String(db))

function stepWord(step: VoiceStep, t: T): string {
  if (step.stage === 'download') {
    const done = step.total
      ? `${weighUpdate(step.got ?? 0)} / ${weighUpdate(step.total)}`
      : weighUpdate(step.got ?? 0)
    return t('voice.downloading', { done })
  }

  return step.stage === 'save' ? t('voice.saving') : t('voice.asking')
}
