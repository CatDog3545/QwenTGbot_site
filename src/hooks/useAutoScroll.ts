import { useEffect, useRef, useCallback } from 'react'

export function useAutoScroll(dependency: unknown) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(true)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
    shouldScrollRef.current = isNearBottom
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (shouldScrollRef.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [dependency])

  return containerRef
}
