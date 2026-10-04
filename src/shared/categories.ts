import type { Song, SongCategory, SongPart } from './types'
import { t } from './i18n'
import { sameText, songNumber } from './songs'

export const REVIVAL = 'cat-revival'
export const ELDER = 'cat-elder'
export const KIDS = 'cat-kids'

export function defaultCategories(): SongCategory[] {
  return [
    { id: REVIVAL, name: t('cats.revival') },
    { id: ELDER, name: t('cats.elder') },
    { id: KIDS, name: t('cats.kids') }
  ]
}

export const titleKey = (title: string): string => sameText(title)

const lyricsKey = (parts: SongPart[]): string => sameText(parts.map((p) => p.text).join('\n'))

export function sameSong(
  songs: Song[],
  title: string,
  number = '',
  exceptId?: string,
  parts?: SongPart[]
): Song | null {
  const key = titleKey(title)
  if (!key) return null

  const wanted = number.trim()
  const lyrics = parts && parts.length > 0 ? lyricsKey(parts) : ''
  return (
    songs.find((song) => {
      if (song.id === exceptId || titleKey(song.title) !== key) return false
      const own = song.number.trim()
      if (!wanted || !own || own === wanted) return true
      return lyrics !== '' && lyricsKey(song.parts) === lyrics
    }) ?? null
  )
}

export function categoryOf(
  song: Pick<Song, 'categoryId'>,
  categories: SongCategory[]
): string | null {
  const id = song.categoryId ?? null
  return id && categories.some((one) => one.id === id) ? id : null
}

export const familyKey = (
  song: Pick<Song, 'categoryId' | 'folderId'>,
  categories: SongCategory[]
): string => `${categoryOf(song, categories) ?? ''}/${song.folderId ?? ''}`

const hasNumber = (song: Song): boolean => songNumber(song) !== Number.MAX_SAFE_INTEGER

function runsOf(songs: Song[]): Song[][] {
  const runs: Song[][] = []
  let last = Infinity
  for (const song of songs) {
    if (!hasNumber(song)) continue
    const n = songNumber(song)
    if (n <= last) runs.push([])
    runs[runs.length - 1].push(song)
    last = n
  }
  return runs
}

export function freeNumbers(
  settled: Song[],
  arriving: Song[],
  keep = true
): Map<string, string> {
  const taken = new Set(settled.filter(hasNumber).map((song) => song.number.trim()))
  const shifted: Song[][] = []

  for (const run of runsOf(arriving)) {
    if (!keep || run.some((song) => taken.has(song.number.trim()))) shifted.push(run)
    else for (const song of run) taken.add(song.number.trim())
  }

  let next = 0
  for (const key of taken) next = Math.max(next, Number.parseInt(key, 10) || 0)

  const out = new Map<string, string>()
  for (const run of shifted) for (const song of run) out.set(song.id, String(++next))
  return out
}

export function settledNumbers(items: Song[], categories: SongCategory[]): Map<string, string> {
  const families = new Map<string, Song[]>()
  for (const song of [...items].reverse()) {
    const key = familyKey(song, categories)
    const family = families.get(key)
    if (family) family.push(song)
    else families.set(key, [song])
  }

  const out = new Map<string, string>()
  for (const family of families.values()) {
    for (const [id, number] of freeNumbers([], family)) out.set(id, number)
  }
  return out
}

export function arrivalNumbers(
  items: Song[],
  categories: SongCategory[],
  ids: string[],
  keep = true
): Map<string, string> {
  const arriving = new Set(ids)
  const byId = new Map(items.map((song) => [song.id, song]))
  const groups = new Map<string, Song[]>()
  for (const id of ids) {
    const song = byId.get(id)
    if (!song) continue
    const key = familyKey(song, categories)
    groups.set(key, [...(groups.get(key) ?? []), song])
  }

  const out = new Map<string, string>()
  for (const [key, list] of groups) {
    const settled = items.filter(
      (song) => !arriving.has(song.id) && familyKey(song, categories) === key
    )
    for (const [id, number] of freeNumbers(settled, list, keep)) out.set(id, number)
  }
  return out
}

export function songsIn(
  songs: Song[],
  categories: SongCategory[],
  categoryId: string | null
): Song[] {
  if (categoryId !== null) return songs.filter((song) => song.categoryId === categoryId)

  const known = new Set(categories.map((one) => one.id))
  return songs.filter((song) => !song.categoryId || !known.has(song.categoryId))
}

export const countIn = (songs: Song[], categoryId: string): number =>
  songs.filter((song) => song.categoryId === categoryId).length

export function freeCategoryName(list: SongCategory[], base: string): string {
  const taken = new Set(list.map((one) => one.name.trim().toLowerCase()))
  if (!taken.has(base.trim().toLowerCase())) return base

  for (let n = 2; n < 500; n++) {
    const name = `${base} ${n}`
    if (!taken.has(name.toLowerCase())) return name
  }
  return base
}

export function movedCategory(list: SongCategory[], id: string, delta: number): SongCategory[] {
  const at = list.findIndex((one) => one.id === id)
  const to = at + delta
  if (at < 0 || to < 0 || to >= list.length) return list

  const next = [...list]
  const [moved] = next.splice(at, 1)
  next.splice(to, 0, moved)
  return next
}

export function placedCategory(
  list: SongCategory[],
  id: string,
  targetId: string
): SongCategory[] {
  const at = list.findIndex((one) => one.id === id)
  const to = list.findIndex((one) => one.id === targetId)
  if (at < 0 || to < 0 || at === to) return list
  return movedCategory(list, id, to - at)
}

export function cleanCategories(value: unknown): SongCategory[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const out: SongCategory[] = []
  for (const one of value) {
    const id = typeof one?.id === 'string' ? one.id.trim() : ''
    const name = typeof one?.name === 'string' ? one.name.trim() : ''
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    out.push({ id, name })
  }
  return out
}

const FROM_CATALOG: Record<string, string> = {
  'tab-revival': REVIVAL,
  'tab-elder': ELDER,
  'tab-kids': KIDS
}

export interface OldCatalog {
  tabs?: { id: string; name: string }[]
  songs?: (Song & { tabId?: string })[]
}

export interface Merged {
  items: Song[]
  categories: SongCategory[]

  added: number

  tagged: number
}

export function mergeCatalog(
  items: Song[],
  categories: SongCategory[],
  old: OldCatalog | null,
  now: number
): Merged {
  const list = categories.length > 0 ? [...categories] : defaultCategories()

  for (const tab of old?.tabs ?? []) {
    const id = FROM_CATALOG[tab.id] ?? tab.id
    const name = typeof tab.name === 'string' ? tab.name.trim() : ''
    if (!id || !name || list.some((one) => one.id === id)) continue
    list.push({ id, name })
  }

  const known = new Set(list.map((one) => one.id))
  const where = (tabId: string | undefined): string | null => {
    const id = tabId ? (FROM_CATALOG[tabId] ?? tabId) : null
    return id && known.has(id) ? id : null
  }

  const next = [...items]
  let added = 0
  let tagged = 0

  for (const song of old?.songs ?? []) {
    if (!song || typeof song.title !== 'string' || !Array.isArray(song.parts)) continue

    const categoryId = where(song.tabId)
    const same = sameSong(next, song.title, song.number ?? '')

    if (same) {
      if (!same.categoryId && categoryId) {
        next[next.indexOf(same)] = { ...same, categoryId }
        tagged++
      }
      continue
    }

    const { tabId: _tab, ...rest } = song
    next.push({
      ...rest,
      id: `song-${now}-c${added}`,
      number: song.number ?? '',
      folderId: null,
      categoryId,
      updatedAt: now,
      playCount: 0,
      lastPlayedAt: null
    })
    added++
  }

  return { items: next, categories: list, added, tagged }
}
