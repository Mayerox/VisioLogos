import { useEffect } from 'react'
import type { EditCommand } from '@shared/types'
import { SEPARATOR, useContextMenu } from './ContextMenu'
import { useT } from '../state/i18n'

type Field = HTMLInputElement | HTMLTextAreaElement

const TYPED = new Set(['text', 'search', 'url', 'email', 'tel'])

function fieldOf(target: EventTarget | null): Field | null {
  if (target instanceof HTMLTextAreaElement) return target
  if (target instanceof HTMLInputElement && TYPED.has(target.type)) return target
  return null
}

export function EditMenu(): React.JSX.Element {
  const t = useT()
  const { openAt, menu } = useContextMenu()

  useEffect(() => {
    const onMenu = (e: MouseEvent): void => {
      if (e.defaultPrevented) return
      const field = fieldOf(e.target)
      if (!field || field.disabled) return
      e.preventDefault()

      const start = field.selectionStart ?? 0
      const end = field.selectionEnd ?? 0
      const chosen = end > start
      const locked = field.readOnly

      const run = (command: EditCommand): void => {
        field.focus()
        field.setSelectionRange(start, end)
        void window.api.app.edit(command)
      }

      const selectAll = (): void => {
        field.focus()
        field.select()
      }

      const pointer = e.clientX !== 0 || e.clientY !== 0
      const box = field.getBoundingClientRect()
      openAt(pointer ? e.clientX : box.left, pointer ? e.clientY : box.bottom + 4, [
        {
          label: t('edit.cut'),
          hint: 'Ctrl+X',
          disabled: !chosen || locked,
          onClick: () => run('cut')
        },
        { label: t('edit.copy'), hint: 'Ctrl+C', disabled: !chosen, onClick: () => run('copy') },
        { label: t('edit.paste'), hint: 'Ctrl+V', disabled: locked, onClick: () => run('paste') },
        SEPARATOR,
        {
          label: t('edit.selectAll'),
          hint: 'Ctrl+A',
          disabled: field.value.length === 0,
          onClick: selectAll
        }
      ])
    }

    document.addEventListener('contextmenu', onMenu)
    return () => document.removeEventListener('contextmenu', onMenu)
  }, [t, openAt])

  return <>{menu}</>
}
