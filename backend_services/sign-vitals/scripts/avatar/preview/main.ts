// Dev-only harness: the app's own stage + mannequin + sampler, next to the
// source video at the same frame. Used by capture.mjs for screenshots and
// frame-rate measurement. ?sign=hello&frame=40 (frame defaults to mid-clip).
import { AvatarStage } from "../../../../../frontend/src/modules/sign-vitals/components/avatar/avatarStage.ts";
import { frameAtTime, type MotionFile } from "../../../../../frontend/src/modules/sign-vitals/components/avatar/motionPlayback.ts";
import { samplePose, type BoneDef } from "../../../../../frontend/src/modules/sign-vitals/components/avatar/rig/AvatarRig.ts";
import { MannequinRig } from "../../../../../frontend/src/modules/sign-vitals/components/avatar/rig/MannequinRig.ts";

declare const __MODULE_DIR__: string;
const fsUrl = (p: string) => `/@fs/${__MODULE_DIR__}/${p}`;

const params = new URLSearchParams(location.search);
const sign = params.get("sign") ?? "hello";

async function setup() {
  const [skeleton, motion] = await Promise.all([
    fetch(fsUrl("assets/motion/standard_skeleton.json")).then((r) => r.json()),
    fetch(fsUrl(`assets/motion/${sign}.json`)).then((r) => r.json() as Promise<MotionFile>),
  ]);
  const frame = Number(params.get("frame") ?? Math.floor(motion.frames / 2));
  const stage = new AvatarStage(document.getElementById("avatar")!, new MannequinRig(skeleton.bones as BoneDef[]));
  stage.rig.applyPose(samplePose(motion, frame));
  stage.render();

  const video = document.getElementById("video") as HTMLVideoElement;
  video.src = fsUrl(`assets/motion/_review/videos/${sign}.mp4`);
  await new Promise<void>((res) => {
    video.onloadeddata = () => {
      video.onseeked = () => res();
      video.currentTime = (frame + 0.5) / motion.fps;
    };
    video.onerror = () => res(); // no video: avatar only
  });
  document.getElementById("caption")!.textContent =
    `${sign} · frame ${frame} of ${motion.frames} · ${motion.fps.toFixed(2)} fps · ${motion.source.video_id}` +
    ` · video ${video.duration ? (video.duration * motion.fps).toFixed(1) : "?"} frames long`;

  // Plays the sign for `seconds` and reports frames per second and the
  // time spent per frame in sampling + rendering.
  (window as unknown as Record<string, unknown>).__measureFps = (seconds = 5) =>
    new Promise((resolve) => {
      const gl = stage.renderer.getContext();
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown";
      let frames = 0, work = 0;
      const t0 = performance.now();
      const tick = (ts: number) => {
        const w0 = performance.now();
        const { frame: f } = frameAtTime((ts - t0) / 1000, motion.fps, [0, motion.frames - 1], true);
        stage.rig.applyPose(samplePose(motion, f));
        stage.render();
        gl.finish();
        work += performance.now() - w0;
        frames++;
        if (ts - t0 < seconds * 1000) requestAnimationFrame(tick);
        else resolve({ fps: (frames * 1000) / (ts - t0), msPerFrame: work / frames, gpu, frames });
      };
      requestAnimationFrame(tick);
    });
}

(window as unknown as Record<string, unknown>).__ready = setup();
