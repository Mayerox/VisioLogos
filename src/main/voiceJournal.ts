import { app, shell } from 'electron'
import { appendFile, mkdir, open, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const KEEP = 40
const LIMIT = 400 * 1024 * 1024
const RATE = 16_000
const HEADER = 44

const folder = (): string => join(app.getPath('userData'), 'voice', 'journal')

interface Session {
  text: string
  sound: string | null
  bytes: number
}

let session: Session | null = null
let queue: Promise<void> = Promise.resolve()

const later = (job: () => Promise<void>): void => {
  queue = queue.then(job).catch((error) => console.error('[Журнал голоса]', error))
}

const pad = (n: number): string => String(n).padStart(2, '0')

const stamp = (at = new Date()): string => {
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${day}_${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`
}

function waveHeader(bytes: number): Buffer {
  const head = Buffer.alloc(HEADER)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + bytes, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(RATE, 24)
  head.writeUInt32LE(RATE * 2, 28)
  head.writeUInt16LE(2, 32)
  head.writeUInt16LE(16, 34)
  head.write('data', 36)
  head.writeUInt32LE(bytes, 40)
  return head
}

async function tidy(): Promise<void> {
  const names = await readdir(folder()).catch(() => [] as string[])
  const groups = new Map<string, { files: string[]; size: number }>()
  for (const name of names) {
    const key = name.replace(/\.(txt|wav)$/, '')
    const info = await stat(join(folder(), name)).catch(() => null)
    if (!info) continue
    const group = groups.get(key) ?? { files: [], size: 0 }
    group.files.push(name)
    group.size += info.size
    groups.set(key, group)
  }

  const newest = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  let total = 0
  for (const [index, [, group]] of newest.entries()) {
    total += group.size
    if (index < KEEP && total <= LIMIT) continue
    for (const name of group.files) await rm(join(folder(), name), { force: true })
  }
}

async function finish(done: Session): Promise<void> {
  if (!done.sound) return
  const file = await open(done.sound, 'r+')
  try {
    await file.write(waveHeader(done.bytes), 0, HEADER, 0)
  } finally {
    await file.close()
  }
}

export function journalStart(withSound: boolean): void {
  const was = session
  const name = stamp()
  const next: Session = {
    text: join(folder(), `${name}.txt`),
    sound: withSound ? join(folder(), `${name}.wav`) : null,
    bytes: 0
  }
  session = next

  later(async () => {
    if (was) await finish(was)
    await mkdir(folder(), { recursive: true })
    await tidy()
    const when = new Date().toLocaleString('ru-RU')
    await appendFile(next.text, `VisioLogos ${app.getVersion()} · листание по голосу · ${when}\n`)
    if (next.sound) await writeFile(next.sound, waveHeader(0))
  })
}

export function journalLine(line: string): void {
  const now = session
  if (!now) return
  const text = `${line.replace(/\s+$/, '')}\n`
  later(() => appendFile(now.text, text))
}

export function journalSound(pcm: Uint8Array): void {
  const now = session
  if (!now?.sound || pcm.byteLength === 0) return
  const sound = now.sound
  now.bytes += pcm.byteLength
  later(() => appendFile(sound, pcm))
}

export function journalStop(): void {
  const was = session
  session = null
  if (was) later(() => finish(was))
}

export async function openJournal(): Promise<void> {
  await mkdir(folder(), { recursive: true })
  await shell.openPath(folder())
}
