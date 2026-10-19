// Dev-only: mounts the app's real WebcamCapture so webcam_check.mjs can
// record from Chrome's fake camera and inspect exactly what would be uploaded.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import WebcamCapture from "../../../../../frontend/src/modules/sign-vitals/components/WebcamCapture.tsx";

const w = window as unknown as Record<string, unknown>;

async function onRecorded(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  w.__recording = { type: blob.type, b64: btoa(s) };
}

createRoot(document.getElementById("root")!).render(
  createElement(WebcamCapture, { onRecorded, onCameraError: () => (w.__cameraError = true) }),
);
