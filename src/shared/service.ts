import type { ServiceFolder, ServiceItem, ServiceItemKind } from './types'
import { lang, t, type Key } from './i18n'

export const itemKindLabel = (kind: ServiceItemKind): string => t(`item.${kind}` as Key)

let counter = 0
const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`

export function noteItem(title: string): ServiceItem {
  return { id: newId('it'), kind: 'note', refId: null, bible: null, title, note: true }
}

export function songItem(refId: string, title: string): ServiceItem {
  return { id: newId('it'), kind: 'song', refId, bible: null, title, note: false }
}

export function textItem(refId: string, title: string): ServiceItem {
  return { id: newId('it'), kind: 'text', refId, bible: null, title, note: false }
}

export function deckItem(refId: string, title: string): ServiceItem {
  return { id: newId('it'), kind: 'deck', refId, bible: null, title, note: false }
}

export function bibleItem(
  bible: NonNullable<ServiceItem['bible']>,
  title: string
): ServiceItem {
  return { id: newId('it'), kind: 'bible', refId: null, bible, title, note: false }
}

export function defaultFolderTitle(date = new Date()): string {
  const weekday = date.toLocaleDateString(lang(), { weekday: 'long' })
  const day = date.toLocaleDateString(lang(), { day: 'numeric', month: 'long' })
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${day}`
}

const isoDay = (d: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function today(): string {
  return isoDay(new Date())
}

const monthWords = (() => {
  const words = new Map<string, number>()
  for (const locale of ['ru', 'en']) {
    for (let m = 0; m < 12; m++) {
      const text = new Date(2000, m, 15).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long'
      })
      const word = text.replace(/[\d\s.,]/g, '').toLowerCase()
      if (word) words.set(word, m)
    }
  }
  return words
})()

export function serviceDay(folder: Pick<ServiceFolder, 'title' | 'date'>): string {
  const words = folder.title.toLowerCase().match(/\p{L}+|\d{1,2}/gu) ?? []
  const base = new Date(`${folder.date}T12:00:00`)
  if (isNaN(base.getTime())) return folder.date
  for (let i = 0; i < words.length; i++) {
    const month = monthWords.get(words[i])
    if (month === undefined) continue
    const day = Number(/^\d+$/.test(words[i - 1] ?? '') ? words[i - 1] : words[i + 1])
    if (!(day >= 1 && day <= 31)) continue
    const gap = (d: Date): number => Math.abs(d.getTime() - base.getTime())
    const near = [-1, 0, 1]
      .map((shift) => new Date(base.getFullYear() + shift, month, day, 12))
      .sort((a, b) => gap(a) - gap(b))[0]
    return isoDay(near)
  }
  return folder.date
}

export function emptyFolder(
  title: string,
  items: ServiceItem[] = [],
  folderId: string | null = null
): ServiceFolder {
  const now = Date.now()
  return {
    id: newId('svc'),
    title,
    date: today(),
    folderId,
    items,
    createdAt: now,
    updatedAt: now
  }
}

export function copyFolder(folder: ServiceFolder, title: string): ServiceFolder {
  return emptyFolder(
    title,
    folder.items.map((item) => ({ ...item, id: newId('it') })),
    folder.folderId ?? null
  )
}

export function usageCount(folders: ServiceFolder[], refId: string): number {
  return folders.filter((f) => f.items.some((i) => i.refId === refId)).length
}

export const dropIndex = (from: number, at: number): number => (from < at ? at - 1 : at)

export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items
  const target = Math.min(Math.max(to, 0), items.length - 1)
  if (target === from) return items

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}
