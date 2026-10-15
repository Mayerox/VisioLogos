import { useEffect, useRef } from 'react'
import type { Motion } from '@shared/types'
import { attachMotion } from '../lib/motion'

export function MotionLayer({
  motion,
  live = true,
  className
}: {
  motion: Motion
  live?: boolean
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    return attachMotion(canvas, motion, live)
  }, [motion, live])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
