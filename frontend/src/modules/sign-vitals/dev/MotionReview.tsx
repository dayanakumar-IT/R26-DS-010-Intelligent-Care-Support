import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { HEAD_FORWARD, poseAt, segments, type MotionFile } from './motionSkeleton'
import trimProposalsJson from '../assets/motion/trim_proposals.json'
import SigningAvatar3D from '../components/avatar/SigningAvatar3D'

// DEV ONLY (route registered only when import.meta.env.DEV). Plays a baked
// motion file as a plain skeleton beside its source video, in sync, to check
// the motion before any avatar exists. Source videos and comparison bakes
// live in assets/motion/_review/ (gitignored).

const MOTION = import.meta.glob<{ default: MotionFile }>('../assets/motion/*.json')
const COMPARE = import.meta.glob<{ default: MotionFile }>('../assets/motion/_review/*.kalidokit.json')
const VIDEOS = import.meta.glob<string>('../assets/motion/_review/videos/*.mp4', { query: '?url', import: 'default' })
const NOT_MOTION = new Set(['standard_skeleton', 'motion_qa', 'trim_proposals'])

const baseName = (p: string) => p.split('/').pop()!.replace(/\.(kalidokit\.)?json$|\.mp4$/, '')
const SIGNS = Object.keys(MOTION).map(baseName).filter((s) => !NOT_MOTION.has(s)).sort()

type Solver = 'direct' | 'kalidokit'
type Verdict = {
  verdict?: 'approved' | 'rejected'
  notes?: string
  solver?: Solver
  reviewed_at?: string
  // Long clips only: whether the proposed motion-file trim is accepted.
  trim?: 'approved' | 'rejected'
}
type QaFile = Record<string, Verdict>
type TrimProposal = { proposed_range: [number, number]; proposed_frames: number; frames: number; reason: string }
const TRIMS = trimProposalsJson as unknown as Record<string, TrimProposal>

const FACE_BARS: Array<[string, string[]]> = [
  ['browDown', ['browDownLeft', 'browDownRight']],
  ['browInnerUp', ['browInnerUp']],
  ['mouthFrown', ['mouthFrownLeft', 'mouthFrownRight']],
  ['jawOpen', ['jawOpen']],
  ['eyeBlink', ['eyeBlinkLeft', 'eyeBlinkRight']],
]

function useSkeletonScene(container: React.RefObject<HTMLDivElement | null>) {
  const ref = useRef<{ group: THREE.Group; render: () => void } | null>(null)
  useEffect(() => {
    const el = container.current
    if (!el) return
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f172a')
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.01, 20)
    camera.position.set(0, 1.35, 2.4) // in front of the character, which faces +Z
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.3, 0)
    controls.update()
    scene.add(new THREE.GridHelper(2, 10, '#334155', '#1e293b'))
    const group = new THREE.Group()
    scene.add(group)
    const render = () => renderer.render(scene, camera)
    controls.addEventListener('change', render)
    ref.current = { group, render }
    render()
    return () => {
      controls.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
      ref.current = null
    }
  }, [container])
  return ref
}

function drawPose(group: THREE.Group, motion: MotionFile, frame: number) {
  group.clear()
  const pose = poseAt(motion, frame)
  const colour = (n: string) => (n.startsWith('right') ? '#f97316' : n.startsWith('left') ? '#38bdf8' : '#e2e8f0')
  for (const { name, a, b } of segments(pose)) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b])
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colour(name) })))
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: '#e2e8f0', wireframe: true }))
  head.position.copy(pose.pos.head).add(new THREE.Vector3(0, 0.08, 0).applyQuaternion(pose.world.head))
  group.add(head)
  const nose = HEAD_FORWARD.clone().multiplyScalar(0.18).applyQuaternion(pose.world.head)
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([head.position, head.position.clone().add(nose)]),
    new THREE.LineBasicMaterial({ color: '#facc15' })))
}

// Persist verdicts straight into assets/motion/motion_qa.json via the File
// System Access API (Chromium), with a download fallback.
type DirHandle = { getFileHandle: (n: string, o?: { create?: boolean }) => Promise<FileHandleLike> }
type FileHandleLike = { getFile: () => Promise<File>; createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }

export default function MotionReview() {
  const [sign, setSign] = useState(SIGNS[0] ?? '')
  const [solver, setSolver] = useState<Solver>('direct')
  const [motion, setMotion] = useState<MotionFile | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [frame, setFrame] = useState(0)
  const [rate, setRate] = useState(1)
  const [qa, setQa] = useState<QaFile>({})
  const [notes, setNotes] = useState('')
  const [dir, setDir] = useState<DirHandle | null>(null)
  const [status, setStatus] = useState('')
  const [loopTrim, setLoopTrim] = useState(false)
  const loopRef = useRef<[number, number] | null>(null)
  const trim = TRIMS[sign]
  useEffect(() => { loopRef.current = loopTrim && trim ? trim.proposed_range : null }, [loopTrim, trim])
  const videoRef = useRef<HTMLVideoElement>(null)
  const sceneEl = useRef<HTMLDivElement>(null)
  const scene = useSkeletonScene(sceneEl)

  useEffect(() => {
    let live = true
    const key = solver === 'kalidokit' ? `../assets/motion/_review/${sign}.kalidokit.json` : `../assets/motion/${sign}.json`
    const loader = (solver === 'kalidokit' ? COMPARE : MOTION)[key]
    loader?.().then((m) => live && setMotion(m.default))
    VIDEOS[`../assets/motion/_review/videos/${sign}.mp4`]?.().then((u) => live && setVideoUrl(u))
    return () => { live = false }
  }, [sign, solver])

  const choose = (nextSign: string, nextSolver: Solver) => {
    setMotion(null)
    setFrame(0)
    setSign(nextSign)
    setSolver(nextSolver)
    setNotes(qa[nextSign]?.notes ?? '')
  }

  // The video is the clock: frame = floor(currentTime * the file's own fps).
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = videoRef.current
      if (v && motion) {
        const f = Math.min(motion.frames - 1, Math.max(0, Math.floor(v.currentTime * motion.fps + 1e-3)))
        const loop = loopRef.current
        // Proposed-trim preview: play only frames [a, b] of the untrimmed file, on repeat.
        if (loop && (f > loop[1] || f < loop[0])) v.currentTime = (loop[0] + 0.5) / motion.fps
        setFrame(f)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [motion])

  useEffect(() => {
    if (scene.current && motion) {
      drawPose(scene.current.group, motion, frame)
      scene.current.render()
    }
  }, [scene, motion, frame])

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = rate }, [rate, videoUrl])

  const step = (d: number) => {
    const v = videoRef.current
    if (!v || !motion) return
    v.pause()
    const next = Math.min(motion.frames - 1, Math.max(0, frame + d))
    v.currentTime = (next + 0.5) / motion.fps
  }

  const flagsNow = useMemo(
    () => (motion?.quality_flags ?? []).filter((f) => frame >= f.frames[0] && frame <= f.frames[1]),
    [motion, frame],
  )

  const connect = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<DirHandle> }).showDirectoryPicker
    if (!picker) { setStatus('This browser cannot write files; verdicts will download instead.'); return }
    const handle = await picker()
    try {
      const file = await (await handle.getFileHandle('motion_qa.json')).getFile()
      const loaded = JSON.parse(await file.text()) as QaFile
      setQa(loaded)
      setNotes(loaded[sign]?.notes ?? '')
      setDir(handle)
      setStatus('Connected to motion_qa.json')
    } catch {
      setStatus('Pick the assets/motion folder (it contains motion_qa.json).')
    }
  }

  const saveQa = useCallback(async (patch: Verdict, label: string) => {
    const next: QaFile = { ...qa, [sign]: { ...qa[sign], ...patch, reviewed_at: new Date().toISOString() } }
    setQa(next)
    const text = JSON.stringify(next, null, 2) + '\n'
    if (dir) {
      const w = await (await dir.getFileHandle('motion_qa.json', { create: true })).createWritable()
      await w.write(text)
      await w.close()
      setStatus(`Saved ${sign}: ${label}`)
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      a.download = 'motion_qa.json'
      a.click()
      setStatus('Downloaded motion_qa.json: copy it into assets/motion/')
    }
  }, [qa, sign, dir])
  const save = (verdict: NonNullable<Verdict['verdict']>) => saveQa({ verdict, notes, solver }, verdict)

  const bar = (names: string[]) => {
    if (!motion) return 0
    const vals = names.map((n) => motion.blendshapes[n]?.[frame] ?? 0)
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">Motion review (dev only)</h1>
        <select value={sign} onChange={(e) => choose(e.target.value, solver)} className="rounded border px-2 py-1">
          {SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={solver} onChange={(e) => choose(sign, e.target.value as Solver)} className="rounded border px-2 py-1">
          <option value="direct">direct solver (committed file)</option>
          <option value="kalidokit">kalidokit (comparison evidence)</option>
        </select>
        <span className="text-slate-500">
          {motion ? `${motion.frames} frames @ ${motion.fps} fps · ${motion.source.video_id}` : 'loading…'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Source video (signer's right hand appears on your left)</span>
          {videoUrl ? (
            <video ref={videoRef} src={videoUrl} controls muted className="w-full rounded bg-black" />
          ) : (
            <p className="rounded border border-dashed p-6 text-slate-500">
              No video in assets/motion/_review/videos/{sign}.mp4
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            Skeleton from baked rotations <span className="text-orange-500">■ right</span>{' '}
            <span className="text-sky-500">■ left</span> <span className="text-yellow-500">■ head forward</span>
          </span>
          <div ref={sceneEl} className="aspect-[4/3] w-full overflow-hidden rounded" />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-2 xl:col-span-1">
          <span className="font-semibold">3D signer (same motion, same frame)</span>
          {motion ? (
            <SigningAvatar3D key={`${sign}:${solver}`} signId={sign} signName={sign} review={{ motion, frame }} />
          ) : (
            <p className="rounded border border-dashed p-6 text-slate-500">loading…</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded border px-3 py-1" onClick={() => step(-1)}>◀ frame</button>
        <button type="button" className="rounded border px-3 py-1" onClick={() => videoRef.current?.play()}>Play</button>
        <button type="button" className="rounded border px-3 py-1" onClick={() => videoRef.current?.pause()}>Pause</button>
        <button type="button" className="rounded border px-3 py-1" onClick={() => step(1)}>frame ▶</button>
        {[0.5, 1].map((r) => (
          <button key={r} type="button" onClick={() => setRate(r)}
            className={`rounded border px-3 py-1 ${rate === r ? 'bg-slate-800 text-white' : ''}`}>{r}×</button>
        ))}
        <span className="font-mono">frame {frame}{motion ? ` / ${motion.frames - 1}` : ''}</span>
      </div>

      {trim && motion && (
        <div className="flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-3">
          <p>
            <b>Proposed trim (motion file only):</b> frames {trim.proposed_range[0]}–{trim.proposed_range[1]}{' '}
            ({trim.proposed_frames} of {trim.frames}). {trim.reason}. The grading reference is never trimmed.
          </p>
          <div className="relative h-3 w-full rounded bg-slate-200" aria-hidden="true">
            <div className="absolute h-3 rounded bg-amber-400" style={{
              left: `${(trim.proposed_range[0] / motion.frames) * 100}%`,
              width: `${(trim.proposed_frames / motion.frames) * 100}%`,
            }} />
            <div className="absolute h-3 w-0.5 bg-slate-900" style={{ left: `${(frame / motion.frames) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`rounded border px-3 py-1 ${loopTrim ? 'bg-amber-500 text-white' : ''}`}
              onClick={() => { setLoopTrim((l) => !l); videoRef.current?.play() }}>
              {loopTrim ? 'Stop trim preview' : 'Play proposed trim (loop)'}
            </button>
            <button type="button" className="rounded bg-emerald-600 px-3 py-1 text-white"
              onClick={() => saveQa({ trim: 'approved' }, 'trim approved')}>Approve trim</button>
            <button type="button" className="rounded bg-rose-600 px-3 py-1 text-white"
              onClick={() => saveQa({ trim: 'rejected' }, 'trim rejected')}>Reject trim</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h2 className="font-semibold">Quality flags at this frame</h2>
          {flagsNow.length === 0 ? <p className="text-slate-500">none</p> : (
            <ul className="list-disc pl-5">{flagsNow.map((f, i) => <li key={i}><b>{f.type}</b> ({f.part}) {f.note}</li>)}</ul>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-slate-600">All flags ({motion?.quality_flags.length ?? 0})</summary>
            <ul className="list-disc pl-5">
              {motion?.quality_flags.map((f, i) => <li key={i}>{f.type} · {f.part} · frames {f.frames[0]}–{f.frames[1]}</li>)}
            </ul>
          </details>
        </div>
        <div>
          <h2 className="font-semibold">Face blendshapes</h2>
          {FACE_BARS.map(([label, names]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-24">{label}</span>
              <div className="h-3 flex-1 rounded bg-slate-200">
                <div className="h-3 rounded bg-violet-500" style={{ width: `${Math.round(bar(names) * 100)}%` }} />
              </div>
              <span className="w-10 text-right font-mono">{bar(names).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded border px-3 py-1" onClick={connect}>
            {dir ? 'Connected to motion folder' : 'Connect assets/motion folder'}
          </button>
          <span className="text-slate-500">
            Current verdict: {qa[sign]?.verdict ? `${qa[sign].verdict} (${qa[sign].solver})` : 'none'}
            {trim && ` · trim: ${qa[sign]?.trim ?? 'not decided'}`}
          </span>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes"
          className="rounded border p-2" />
        <div className="flex gap-2">
          <button type="button" className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={() => save('approved')}>Approve</button>
          <button type="button" className="rounded bg-rose-600 px-3 py-1 text-white" onClick={() => save('rejected')}>Reject</button>
          <span className="self-center text-slate-500">{status}</span>
        </div>
      </div>
    </div>
  )
}
