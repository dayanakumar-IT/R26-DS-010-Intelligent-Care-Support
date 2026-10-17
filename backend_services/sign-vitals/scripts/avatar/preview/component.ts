// Dev-only: mounts the app's real SigningAvatar3D (unstyled: no Tailwind
// here) so capture.mjs --component can check its behaviour in Chrome.
import { createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import SigningAvatar3D from "../../../../../frontend/src/modules/sign-vitals/components/avatar/SigningAvatar3D.tsx";

const root = createRoot(document.getElementById("root")!);
const log: string[] = [];
const w = window as unknown as Record<string, unknown>;
w.__log = log;
w.__mount = (signId: string) =>
  root.render(createElement(SigningAvatar3D, {
    key: `${signId}-${Math.random()}`,
    signId,
    signName: signId,
    onUnavailable: (reason: string) => log.push(`unavailable: ${reason}`),
  }));
w.__unmount = () => root.render(createElement(Fragment));
