import { useRef, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Card } from '../../../shared/components/Card'
import cls from './signVitals.module.css'

export function AvatarDemonstration() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)

  const togglePlay = () => {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
      setPlaying(false)
    } else {
      void videoRef.current.play()
      setPlaying(true)
    }
  }

  const replay = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    void videoRef.current.play()
    setPlaying(true)
  }

  const slow = () => {
    if (!videoRef.current) return
    const nextSpeed = speed === 1 ? 0.6 : 1
    videoRef.current.playbackRate = nextSpeed
    setSpeed(nextSpeed)
  }

  return (
    <Card title="Learn the Sign">
      <p>Watch and follow the demonstration.</p>
      <div className={cls.avatarPanel}>
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className={cls.avatarVideo}
          poster="https://dummyimage.com/640x360/e9e5ff/5b4eff&text=HELP+Sign+Avatar+Demo"
        />
        <div className={cls.avatarOverlayNote}>Demo sign: HELP (right hand near chest, smooth motion)</div>
      </div>
      <div className={cls.buttonRow}>
        <Button variant="secondary" onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</Button>
        <Button variant="secondary" onClick={replay}>Replay</Button>
        <Button variant="secondary" onClick={slow}>{speed === 1 ? 'Slow Motion' : 'Normal Speed'}</Button>
      </div>
      <div className={cls.buttonRow}>
        <Button variant="ghost">Front View</Button>
        <Button variant="ghost">Side View</Button>
      </div>
    </Card>
  )
}
