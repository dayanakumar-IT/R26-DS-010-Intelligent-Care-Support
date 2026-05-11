import { useEffect, useRef, useState } from 'react'

type PollingState<T> = {
  data: T | null
  error: unknown
  isLoading: boolean
  lastUpdatedAt: number | null
}

/**
 * Minimal polling helper for "live update" UI.
 * - Keeps last good `data` on errors
 * - Aborts in-flight request on unmount / re-run
 */
export function usePolling<T>(
  fetcher: (ctx: { signal: AbortSignal }) => Promise<T>,
  options: {
    intervalMs: number
    enabled?: boolean
    immediate?: boolean
  },
) {
  const { intervalMs, enabled = true, immediate = true } = options
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [state, setState] = useState<PollingState<T>>({
    data: null,
    error: null,
    isLoading: Boolean(immediate && enabled),
    lastUpdatedAt: null,
  })

  useEffect(() => {
    if (!enabled) return

    let mounted = true
    let timeoutId: number | null = null
    let controller: AbortController | null = null

    const run = async () => {
      controller?.abort()
      controller = new AbortController()

      setState((s) => ({ ...s, isLoading: s.data == null }))

      try {
        const data = await fetcherRef.current({ signal: controller.signal })
        if (!mounted) return
        setState({ data, error: null, isLoading: false, lastUpdatedAt: Date.now() })
      } catch (error) {
        if (!mounted) return
        // keep last good data; store latest error
        setState((s) => ({ ...s, error, isLoading: false }))
      } finally {
        if (!mounted) return
        timeoutId = window.setTimeout(run, intervalMs)
      }
    }

    if (immediate) void run()
    else timeoutId = window.setTimeout(run, intervalMs)

    return () => {
      mounted = false
      controller?.abort()
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [enabled, immediate, intervalMs])

  return state
}

