import { useCallback, useRef, useState } from 'react'

/** One shared audio player per component tree: only one clip plays at a
 * time (starting another stops the current one), Stop resets to the
 * beginning, and the playing id clears automatically when a clip ends. */
export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audio.onended = null
      audio.onerror = null
    }
    audioRef.current = null
    setPlayingId(null)
  }, [])

  const play = useCallback(
    async (id: string, resolveUrl: () => Promise<string>) => {
      stop()
      setPlayingId(id)
      try {
        const url = await resolveUrl()
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          if (audioRef.current === audio) {
            audioRef.current = null
            setPlayingId(null)
          }
        }
        audio.onerror = () => {
          if (audioRef.current === audio) {
            audioRef.current = null
            setPlayingId(null)
          }
        }
        await audio.play()
      } catch (err) {
        if (audioRef.current) {
          audioRef.current.onended = null
          audioRef.current.onerror = null
        }
        audioRef.current = null
        setPlayingId(null)
        throw err
      }
    },
    [stop],
  )

  const toggle = useCallback(
    async (id: string, resolveUrl: () => Promise<string>) => {
      if (playingId === id) {
        stop()
        return
      }
      await play(id, resolveUrl)
    },
    [playingId, play, stop],
  )

  return { playingId, toggle, stop }
}
