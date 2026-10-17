// Dev-only: the real SignLanguage page with the API served from a snapshot
// (mocks/glossApi.ts). Used for Checkpoint screenshots without a login.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "./styles.css";
import SignLanguage from "../../../../../frontend/src/modules/sign-vitals/pages/SignLanguage.tsx";

createRoot(document.getElementById("root")!).render(
  createElement(MemoryRouter, null, createElement(SignLanguage)),
);
