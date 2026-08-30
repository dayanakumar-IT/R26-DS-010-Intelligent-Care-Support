import { useEffect, useState } from 'react'
import { fetchAvailableDates } from '../services/scribeApi'
import { defaultPeriodFromAvailable, sanitizePeriodSelection } from '../utils/dateRange'

interface UsePatientAvailableDatesOptions {
  patientId: number | ''
  caregiverId?: string
}

export function usePatientAvailableDates({
  patientId,
  caregiverId,
}: UsePatientAvailableDatesOptions) {
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (patientId === '') {
      setDates([])
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    void fetchAvailableDates(patientId, caregiverId)
      .then((response) => {
        if (!isMounted) return
        setDates(response.dates)
      })
      .catch((err) => {
        if (!isMounted) return
        setDates([])
        setError(err instanceof Error ? err.message : 'Failed to load available dates.')
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [patientId, caregiverId])

  return { dates, loading, error }
}

export function usePeriodDateSelection(
  availableDates: string[],
  start: string,
  end: string,
  setStart: (value: string) => void,
  setEnd: (value: string) => void,
) {
  useEffect(() => {
    if (availableDates.length === 0) {
      if (start) setStart('')
      if (end) setEnd('')
      return
    }

    const startValid = availableDates.includes(start)
    const endValid = availableDates.includes(end)
    if (startValid && endValid && start <= end) {
      return
    }

    const defaults = defaultPeriodFromAvailable(availableDates)
    const next = sanitizePeriodSelection(availableDates, start || defaults.start, end || defaults.end)
    if (next.start !== start) {
      setStart(next.start)
    }
    if (next.end !== end) {
      setEnd(next.end)
    }
  }, [availableDates, start, end, setStart, setEnd])
}
