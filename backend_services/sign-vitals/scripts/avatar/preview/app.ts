// Dev-only: the real SignLanguage page (or, with ?page=overview, the Sign &
// Vitals Overview page incl. the supervisor view) with the API served from a
// snapshot (mocks/glossApi.ts). Used for Checkpoint screenshots without a login.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./styles.css";
import SignLanguage from "../../../../../frontend/src/modules/sign-vitals/pages/SignLanguage.tsx";
import Overview from "../../../../../frontend/src/modules/sign-vitals/pages/Overview.tsx";

const page = new URLSearchParams(location.search).get("page") === "overview" ? Overview : SignLanguage;
createRoot(document.getElementById("root")!).render(
  createElement(MemoryRouter, null, createElement(page)),
);
