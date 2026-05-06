# Intelligent Care Support — Fall Detection Frontend Documentation

**Project:** R26-DS-010 Intelligent Care Support  
**Module:** Fall Detection & Skeletal Monitoring  
**Stack:** React 19 · TypeScript · Vite · Zustand · Tailwind CSS  
**Date:** May 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture & Design Patterns](#4-architecture--design-patterns)
5. [State Management](#5-state-management)
6. [Data Layer](#6-data-layer)
7. [Routing & Layout](#7-routing--layout)
8. [Fall Detection Module — Deep Dive](#8-fall-detection-module--deep-dive)
   - [FallDetectionPage](#81-falldetectionpage)
   - [DashboardTab](#82-dashboardtab)
   - [RoomOverviewTab](#83-roomoverviewtab)
   - [AlertsRiskTab](#84-alertsrisktab)
   - [EventReplayTab](#85-eventreplaytab)
   - [ReportsTab](#86-reporststab)
   - [SettingsTab](#87-settingstab)
   - [PatientDetailPanel](#88-patientdetailpanel)
9. [Skeleton Animation Engine](#9-skeleton-animation-engine)
10. [Chart Components](#10-chart-components)
11. [Type Definitions](#11-type-definitions)
12. [Styling System](#12-styling-system)
13. [Color Palette & Visual Language](#13-color-palette--visual-language)
14. [Key Algorithms & Logic](#14-key-algorithms--logic)
15. [Component Interaction Map](#15-component-interaction-map)

---

## 1. Project Overview

The **Intelligent Care Support** frontend is a real-time patient monitoring dashboard built for hospital supervisors and caregivers. It focuses on **fall risk detection** using AI-driven skeletal pose analysis. The system ingests live sensor data (simulated via a Zustand ticker in development), classifies patient risk levels, and provides an interactive UI for monitoring, reviewing incidents, and generating supervisor reports.

### Core Capabilities

| Capability | Description |
|---|---|
| **Live Patient Monitoring** | Real-time risk scores updated every 2.5 seconds for 24 patients |
| **Skeletal Pose Replay** | SVG-based animated skeleton visualization per patient event |
| **Room Overview** | Bed-level occupancy and risk breakdown per ward |
| **Alert Management** | Acknowledge and resolve fall-risk alerts with audit trail |
| **Report Generation** | PDF/CSV supervisor reports with period-aware dynamic content |
| **Settings** | Notification, camera, risk threshold, and data retention configuration |

---

## 2. Technology Stack

### Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2.5 | Core UI library |
| `react-dom` | 19.2.5 | DOM rendering |
| `react-router-dom` | 7.15.0 | Client-side SPA routing |
| `zustand` | 5.0.12 | Lightweight global state management |
| `axios` | 1.16.0 | HTTP client for future API integration |
| `lucide-react` | 1.14.0 | Icon set |
| `tailwindcss` | 4.2.4 | Utility-first CSS framework |
| `@tailwindcss/vite` | 4.2.4 | Tailwind integration for Vite |

### Development Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | 8.0.10 | Build tool and dev server |
| `typescript` | ~6.0.2 | Static type checking |
| `@vitejs/plugin-react` | latest | JSX transform and Fast Refresh |
| `eslint` | latest | Code linting |

### Build Configuration

**vite.config.ts** — Minimal setup with React JSX plugin and Tailwind Vite integration. Outputs to `dist/`.

**tsconfig.json** — Strict mode enabled. Targets ES2020. References `tsconfig.app.json` (browser code) and `tsconfig.node.json` (build scripts).

### npm Scripts

```bash
npm run dev       # Start Vite dev server (hot reload)
npm run build     # tsc --noEmit && vite build
npm run lint      # ESLint across src/
npm run preview   # Serve production build locally
```

---

## 3. Project Structure

```
frontend/
├── index.html                          # SPA entry point
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                        # ReactDOM.createRoot → <App />
    ├── App.tsx                         # Re-export from app/App.tsx
    ├── index.css                       # Global reset + Tailwind base
    │
    ├── app/
    │   ├── App.tsx                     # <RouterProvider router={router} />
    │   ├── routes.tsx                  # All route definitions
    │   └── layout/
    │       ├── MainLayout.tsx          # Shell: Sidebar + <Outlet />
    │       ├── Sidebar.tsx             # Navigation sidebar
    │       └── layout.module.css
    │
    ├── pages/
    │   ├── Home.tsx                    # Landing dashboard
    │   ├── Login.tsx                   # Authentication form
    │   └── NotFound.tsx                # 404 fallback
    │
    ├── components/
    │   └── PrivateRoute.tsx            # Auth-gated route wrapper
    │
    ├── config/
    │   └── auth.ts                     # Auth configuration constants
    │
    ├── shared/
    │   ├── components/                 # Reusable UI atoms
    │   │   ├── Badge.tsx
    │   │   ├── Button.tsx
    │   │   ├── Card.tsx
    │   │   ├── ChartCard.tsx
    │   │   ├── Icons.tsx
    │   │   └── Table.tsx
    │   └── services/
    │       └── api.ts                  # Axios instance + interceptors
    │
    ├── assets/
    │   ├── care-sense-logo.png
    │   └── caresense-logo-provided.png
    │
    ├── types/
    │   └── user.ts                     # App-wide user type
    │
    └── modules/
        ├── fall-detection/             # ← PRIMARY MODULE (documented below)
        ├── deterioration-detection/
        ├── sign-vitals/
        └── voice-log/
```

### Fall Detection Module Structure

```
modules/fall-detection/
├── pages/
│   └── FallDetectionPage.tsx           # Root page — tab controller, header, footer
│
├── components/
│   ├── PatientDetailPanel.tsx          # Full patient modal (5 sub-tabs)
│   ├── Charts.tsx                      # All SVG chart primitives
│   ├── SkeletonPose.tsx                # Standalone skeleton renderer
│   └── tabs/
│       ├── DashboardTab.tsx            # Overview: stats, charts, alerts
│       ├── RoomOverviewTab.tsx         # Per-room bed map and patient table
│       ├── AlertsRiskTab.tsx           # Alert table with acknowledge/resolve
│       ├── EventReplayTab.tsx          # Event cards + skeletal replay modal
│       ├── ReportsTab.tsx              # Dynamic PDF/CSV report generator
│       └── SettingsTab.tsx             # System configuration UI
│
├── store/
│   └── useFallStore.ts                 # Zustand store (live state + actions)
│
├── types/
│   └── index.ts                        # All TypeScript interfaces and unions
│
├── data/
│   └── mockData.ts                     # Seed patients, rooms, alerts, history
│
├── utils/
│   └── skeletonScenarios.ts            # Skeleton animation engine
│
└── routes.tsx                          # Module route definitions
```

---

## 4. Architecture & Design Patterns

### Feature-Based Module Architecture

Each feature (fall-detection, deterioration-detection, sign-vitals, voice-log) is a self-contained module with its own pages, components, store, types, data, and routes. This allows independent development and future code-splitting.

### Component Hierarchy

```
<App>                          ← RouterProvider
  <MainLayout>                 ← Sidebar + Outlet
    <FallDetectionPage>        ← Tab controller, header, footer, live ticker
      <DashboardTab>
      <RoomOverviewTab>
      <AlertsRiskTab>
      <EventReplayTab>
        <EventCard>
        [Modal] SkeletonSVG + heatmap
      <ReportsTab>
      <SettingsTab>
      <PatientDetailPanel>     ← Floating modal (any tab can open it)
        <OverviewTab>
        <LiveViewTab>
        <HistoryTab>
        <ReplayTab>
        <AnalyticsTab>
```

### State Flow

```
mockData.ts (seed)
    ↓
useFallStore (Zustand)         ← startLive() ticker every 2.5s
    ↓ patients, alerts
FallDetectionPage              ← provides context via prop drilling / store
    ↓
Tab components                 ← read patients/alerts from store
    ↓
PatientDetailPanel             ← receives patient via selectedPatient state
```

### Styling Strategy

- **Tailwind CSS** for structural/layout classes
- **Inline `style` props** for dynamic values (risk colors, widths, conditional borders)
- **CSS Modules** (`.module.css`) for layout-level isolation (Sidebar, MainLayout)
- **No external component library** — all UI built from scratch

### No External Chart Library

All charts are hand-written SVG components inside `Charts.tsx`. This avoids heavy bundle size and gives full control over animations and color.

---

## 5. State Management

### Zustand Store — `useFallStore.ts`

Zustand was chosen over Redux for its zero-boilerplate API and direct mutation pattern.

#### State Shape

```typescript
interface FallStore {
  patients:      Patient[]       // 24 patients seeded from mockData
  alerts:        FallAlert[]     // Live alert queue (max 30)
  lastUpdate:    Date
  edgeConnected: boolean         // Edge AI connection status
}
```

#### Actions

| Action | Description |
|---|---|
| `acknowledgeAlert(id)` | Sets alert status to `'Acknowledged'` |
| `resolveAlert(id)` | Sets alert status to `'Resolved'` |
| `setAlerts(updater)` | Batch update alerts array |
| `tick()` | Advances simulation: updates 10 random patients and generates new alerts |
| `startLive()` | Starts `setInterval(tick, 2500)` and returns cleanup function |

#### Live Simulation — `tick()` Logic

Every 2.5 seconds, `tick()`:

1. Picks 10 random patients
2. Applies a ±8 noise delta to each risk score, with a slight upward bias (`delta = (Math.random() - 0.45) * 8`)
3. Clamps the result between 5 and 98
4. Recalculates `riskLevel`: `< 41 → Low`, `41–70 → Moderate`, `> 70 → High`
5. Appends the new score to a 10-point `trend` array (shifts oldest out)
6. Randomly fluctuates `confidence` between 0.60 and 0.99
7. If a patient crosses the High Risk threshold (score > 71), auto-creates a new alert of type `'Risk Escalation'`
8. Trims alert queue to the 30 most recent

This creates realistic-looking live fluctuations visible across all tabs.

---

## 6. Data Layer

### Mock Data — `mockData.ts`

All data is static seed data used in development. The store initialises from this file.

#### Patients (24 total)

| Room | Low Risk | Moderate Risk | High Risk | Total |
|---|---|---|---|---|
| Room 01 | 6 | 4 | 2 | 12 |
| Room 02 | 5 | 4 | 3 | 12 |

Each patient record:

```typescript
{
  id: 'P001',
  name: 'Maria Silva',
  age: 78,
  gender: 'Female',
  room: 'Room 01',
  bed: 'Bed 1',
  posture: 'Lying',          // 'Lying' | 'Sitting' | 'Standing' | 'Walking'
  riskLevel: 'High Risk',
  riskScore: 82,             // 5–98
  confidence: 0.89,          // AI confidence 0.60–0.99
  trend: [72,74,76,78,80,81,82,83,82,82],  // 10-point history
  lastUpdated: '10:28 AM',
  status: 'Alert',           // 'Normal' | 'Monitoring' | 'Alert' | 'Recovery'
}
```

#### ROOMS Constant

```typescript
ROOMS = [
  { name: 'Room 01', totalBeds: 12, bedsOccupied: 12, alerts: 3,
    riskBreakdown: { low: 6, moderate: 4, high: 2 } },
  { name: 'Room 02', totalBeds: 12, bedsOccupied: 12, alerts: 2,
    riskBreakdown: { low: 5, moderate: 4, high: 3 } },
]
```

#### Active Alerts (8 seeded)

Alert types: `Risk Escalation` · `Abnormal Posture` · `Instability` · `Recovery`  
Statuses: `New` · `Acknowledged` · `Resolved`

#### PATIENT_HISTORY

6 patients have detailed historical records (3–6 entries each) containing:
- `time`, `event` description, `riskLevel`, `riskScore`, `duration`

Used by EventReplayTab to populate the event card grid.

#### Statistical Constants

```typescript
POSTURE_DIST   // Standing 45%, Sitting 25%, Walking 20%, Lying 10%
ALERT_TREND    // [2, 3, 1, 4, 3, 5, 6, 4, 5, 8] — 10-period sparkline
RISK_TREND     // 7 days of {low, moderate, high} counts for BarChart
```

---

## 7. Routing & Layout

### Route Map

```
/                  → Login (public)
/dashboard         → Home (PrivateRoute)
/fall-detection    → FallDetectionPage (PrivateRoute)
/deterioration     → Deterioration module
/vitals            → Sign Vitals module
/voice-log         → Voice Log module
*                  → NotFound
```

### PrivateRoute

Checks auth state. If unauthenticated, redirects to `/`. Wraps all feature routes.

### MainLayout

Renders the persistent `<Sidebar>` on the left and `<Outlet>` for the active page on the right. Sidebar links correspond to the route map above and highlight the active route.

---

## 8. Fall Detection Module — Deep Dive

### 8.1 FallDetectionPage

**File:** `pages/FallDetectionPage.tsx`

The root container for the entire fall detection experience.

#### Responsibilities

- Renders the top header bar with:
  - Live clock (updates every second via `setInterval`)
  - Notification bell badge (unread alert count)
  - Sliding notification panel (right sidebar, auto-dismisses after 4s)
  - Supervisor avatar / username
- Renders 6 tab buttons: Dashboard · Room Overview · Alerts & Risk · Event Replay · Reports · Settings
- Renders the active tab component based on `activeTab` state
- Renders `<PatientDetailPanel>` when `selectedPatient !== null`
- Calls `startLive()` on mount, cleans up on unmount
- Footer: Edge AI connection status · Inference FPS (simulated) · Patient count · Active alert count

#### Key State

```typescript
const [activeTab, setActiveTab]           = useState<FallTab>('dashboard')
const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
const [notifOpen, setNotifOpen]           = useState(false)
```

#### Tab Components Rendered

```tsx
{activeTab === 'dashboard'     && <DashboardTab    onSelectPatient={setSelectedPatient} />}
{activeTab === 'room-overview' && <RoomOverviewTab onSelectPatient={setSelectedPatient} />}
{activeTab === 'alerts-risk'   && <AlertsRiskTab   onSelectPatient={setSelectedPatient} />}
{activeTab === 'event-replay'  && <EventReplayTab  />}
{activeTab === 'reports'       && <ReportsTab      />}
{activeTab === 'settings'      && <SettingsTab     />}
```

---

### 8.2 DashboardTab

**File:** `components/tabs/DashboardTab.tsx`

The main overview screen a supervisor sees first.

#### Layout (3-column grid)

**Row 1 — Stat Cards (5 cards)**

| Card | Value Source |
|---|---|
| Total Patients | `patients.length` |
| Low Risk | `patients.filter(p => p.riskLevel === 'Low Risk').length` |
| Moderate Risk | `patients.filter(...)` |
| High Risk | `patients.filter(...)` |
| Active Alerts | `alerts.filter(a => a.status !== 'Resolved').length` |

**Row 2 — Alert Banner**

A cycling banner for High Risk patients. Cycles every 4 seconds through all `High Risk` patients. Each banner card shows patient name, room/bed, risk score, and a "View Patient" button that opens `PatientDetailPanel`.

**Row 3 — 3-Column Grid**

- **Left:** Room Occupancy table (Room 01 / Room 02, bed count bars, risk breakdown pill tags)
- **Center:** Risk Distribution DonutChart (Low / Moderate / High segments with count labels)
- **Right:** Recent Alerts list (last 5 non-resolved, with risk badge + acknowledge/resolve buttons)

**Row 4 — Progressive Risk Indicator**

Shows 6 patients at a time as risk-score cards. Auto-rotates every 30 seconds. A countdown arc shows seconds until next rotation. Each card shows patient name, room/bed, a `RiskArc` gauge, posture icon, and a live `Sparkline` trend.

---

### 8.3 RoomOverviewTab

**File:** `components/tabs/RoomOverviewTab.tsx`

A ward-level view showing bed-by-bed patient status.

#### Layout

**Summary Stats Bar (4 cards)**

| Stat | Computed From |
|---|---|
| Total Patients | `patients.length` |
| Bed Occupancy % | `ROOMS.reduce(occupied) / ROOMS.reduce(total) * 100` |
| Active Alerts | `ROOMS.reduce((acc, r) => acc + r.alerts, 0)` |
| High Risk | `patients.filter(p => p.riskLevel === 'High Risk').length` |

**3-Column Grid**

- **Col 1 + Col 2:** Room cards for Room 01 and Room 02. Each shows:
  - Room name, bed occupancy fraction, Low/Moderate/High counts
  - Bed occupancy progress bar
  - 12-cell bed map grid (color coded: teal = Low, amber = Moderate, red = High Risk)
  
- **Col 3 (fixed 300px):** 
  - Risk Distribution DonutChart
  - High Risk Patients list (scrollable, capped at `maxHeight: 220px`, `overflowY: auto`)

**Grid fix:** The outer grid uses `alignItems: 'stretch'` so Room cards always fill the full row height, eliminating any gray gap below them.

**Patient Status Table**

Below the grid: filterable full patient table with columns — ID, Name, Age, Room/Bed, Posture, Risk Level, Risk Score, Status, Last Updated, Action (View button).

---

### 8.4 AlertsRiskTab

**File:** `components/tabs/AlertsRiskTab.tsx`

Full alert management interface.

#### Filters

- Risk Level: All · High Risk · Moderate Risk · Low Risk
- Alert Status: All · New · Acknowledged · Resolved

#### Alert Table (10 columns)

Alert ID · Patient ID · Patient Name & Bed · Room · Risk Level · Alert Type · Description · Time · Status badge · Actions (View / Acknowledge / Resolve)

Actions call `acknowledgeAlert(id)` / `resolveAlert(id)` from the Zustand store directly.

#### Right Summary Panel

- Total / New / Acknowledged / Resolved counts
- 10-period alert trend `Sparkline`
- Quick action: "Acknowledge All New" button

---

### 8.5 EventReplayTab

**File:** `components/tabs/EventReplayTab.tsx`

Allows supervisors to review individual fall-risk events and play back the AI's skeletal analysis frame-by-frame.

#### Event Card Grid

Events are built from `PATIENT_HISTORY` merged with patient records. Each event card shows:
- Risk score badge
- Patient name + ID
- Event description
- Risk level + scenario category tags
- Room/bed + timestamp

Clicking any card opens the **Replay Modal**.

#### Replay Modal

The modal contains two sections:

**Dark Section (Skeleton Canvas)**

- ST-GCN · Edge AI · scenario category badges
- Animated `SkeletonSVG` component (see Section 9)
- Stage label badge (e.g. "⚠ NEAR FALL") with glowing dot
- Live risk score (top-right, color coded)
- Scenario event label (bottom center)
- Phase step buttons: **1. Normal → 2. Early Signs → 3. High Risk → 4. Near-Fall** (Recovery removed)
- Playback controls: ⏮ Restart · ⏸/▶ Play/Pause · ⏭ Skip · time counter · ×0.5 / ×1 / ×2 speed

**White Section (Analysis Data)**

- 4 metadata cards: Event Type · Duration · Phase (X/4) · Room/Bed
- Instability Heatmap table:
  - Mini static skeleton diagram (SVG, joints colored red/green)
  - Joint Instability Index bars (Head/Neck, Shoulders, Trunk, Hips, Knees, Ankles — 0–82%)
  - Contributing Factors list (4 per scenario category)

#### Animation Loop

The modal loops animation within a risk-appropriate range:
- **High Risk** patient → loops frames 17–29 (High Risk + Near-Fall)
- **Moderate Risk** → loops frames 8–16 (Early Signs)
- **Low Risk** → loops frames 0–7 (Normal)

Maximum frame index is 29 (Recovery phase never plays — capped at `slice(0, 30)`).

---

### 8.6 ReportsTab

**File:** `components/tabs/ReportsTab.tsx`

Generates supervisor-ready at-a-glance reports with fully dynamic content based on selected filters.

#### Filters

| Filter | Options |
|---|---|
| Report Type | Daily Report · Weekly Report · Monthly Report · Custom Range |
| Date Input | Single date (Daily/Weekly) · Month picker `<input type="month">` (Monthly) · Date range (Custom) |
| Room Filter | All Rooms · Room 01 · Room 02 |

#### Dynamic Content

The entire report body changes based on the selected Report Type via a `PERIOD_SCALE` constant:

```typescript
const PERIOD_SCALE = {
  'Daily Report':   { alertMult: 1,    fallMult: 1,  eventMult: 1   },
  'Weekly Report':  { alertMult: 6.8,  fallMult: 3,  eventMult: 5.5 },
  'Monthly Report': { alertMult: 28.5, fallMult: 11, eventMult: 22  },
  'Custom Range':   { alertMult: 1,    fallMult: 1,  eventMult: 1   },
}
```

Scaled stats: Total Alerts · Falls · Events · High Risk incidents

A `dateLabel` string is computed per type:
- Daily: `"06-05-2026"`
- Weekly: `"30-04-2026 – 06-05-2026"`
- Monthly: `"May 2026"`
- Custom: `"startDate – endDate"`

`periodWord` and `periodAdj` variables drive all text ("today" / "this week" / "this month").

#### Report Sections

1. **5 Stat Cards** — Total Patients · High Risk · Total Alerts · Falls · Avg Risk Score
2. **Supervisor At-a-Glance** — Ward Status badge (STABLE / CAUTION / CRITICAL), dynamically derived from high-risk patient count
3. **Key Findings** — Dynamically generated bullet list referencing `periodWord`
4. **Supervisor Recommendations** — Period-aware action items
5. **Chart section** — BarChart (risk distribution) + LineChart (7-day or monthly trend)

#### Export Functions

**PDF / Print:**
```typescript
const win = window.open('', '_blank')
win.document.write(buildReportHTML())  // Full styled HTML page
win.document.close()
setTimeout(() => { win.focus(); win.print() }, 600)
```

**CSV:**
```typescript
const blob = new Blob([buildCSV()], { type: 'text/csv' })
const url  = URL.createObjectURL(blob)
const a    = document.createElement('a')
a.href = url; a.download = `report-${dateLabel}.csv`; a.click()
URL.revokeObjectURL(url)
```

No external PDF library is used — `window.print()` with a full print-ready HTML template handles PDF export natively.

---

### 8.7 SettingsTab

**File:** `components/tabs/SettingsTab.tsx`

Configuration panel split into 4 sections.

| Section | Settings |
|---|---|
| **User Settings** | Display Name · Email · Role (read-only) · Change Password |
| **Notification Settings** | 6 toggles: High/Moderate/Low risk alerts · Email notifications · Sound alerts · Desktop notifications |
| **System Settings** | Camera source dropdown · Inference FPS slider (1–30) · Risk threshold sliders (Low: 0–40, Moderate: 41–70, High: 71–100) |
| **Data & Privacy** | Auto-delete toggle · Retention period (7–180 days slider) · Storage usage gauge · Export Data button · Clear Cache button |

All settings are local component state only — no persistence in the current implementation.

---

### 8.8 PatientDetailPanel

**File:** `components/PatientDetailPanel.tsx`

A full-screen floating modal opened when a patient row or card is clicked from any tab.

#### 5 Sub-tabs

**1. Overview**

- Patient info grid: Age, Gender, Room/Bed, Status, Last Updated, Posture
- Live risk score with color-coded background
- Skeleton pose SVG (animated, showing current risk zone)
- Risk Assessment bar: 0–100 scale with Low/Moderate/High zones marked
- Contributing factors chip list

**2. Live View**

- Full-size `SkeletonSVG` animation (continuous, risk-level loop)
- Live risk gauge (`RiskArc` component, 200° arc)
- Activity description (dynamically pulled from `getLiveActivity()`)
- Movement log: last 10 activity description strings, timestamped

**3. History**

- Filterable event table from `PATIENT_HISTORY[patient.id]`
- Filters: Risk Level · Event Type
- Stats summary: total events · high risk count · avg duration
- Timeline of events with risk color coding

**4. Replay**

- Same skeleton animation as EventReplayTab modal
- Frame scrubber slider
- Stage jump buttons (4 stages)
- Playback speed controls
- Joint instability heatmap table
- Confidence + speed readouts per frame

**5. Analytics**

- Confidence heatmap (hour × day grid, color-coded)
- Risk score trend `LineChart` (7-day)
- Key insights derived from trend data

#### SkeletonCanvas Sub-component (inside PatientDetailPanel)

An internal component that manages the animation loop. It calls `getPatientScenario(patient.id)` then loops within the appropriate risk zone:

```typescript
// Loop ranges based on patient's current risk level
if (status === 'Alert' && riskLevel === 'High Risk') {
  loopStart = 17; loopEnd = 29   // stuck in Near-Fall zone
} else if (riskLevel === 'High Risk') {
  loopStart = 8;  loopEnd = 23
} else if (riskLevel === 'Moderate Risk') {
  loopStart = 0;  loopEnd = 16
} else {
  loopStart = 0;  loopEnd = 7    // Normal only
}
```

---

## 9. Skeleton Animation Engine

**File:** `utils/skeletonScenarios.ts`

The skeleton engine powers both the EventReplayTab and PatientDetailPanel. It generates animated skeletal figure data for 6 different fall scenarios.

### Joint Anatomy (15 joints)

```
head → neck → lShoulder / rShoulder
              lElbow    / rElbow
              lWrist    / rWrist
       neck → torso → lHip / rHip
                       lKnee / rKnee
                       lAnkle / rAnkle
```

14 bones connect these joints (defined in the `BONES` array).

### 6 Scenario Types

| ID | Scenario | Base Pose | Description |
|---|---|---|---|
| 0 | BED_RISE | `LYING_JOINTS` | Person lying horizontal, rises via tilt rotation |
| 1 | CHAIR_STAND | `SEATED_JOINTS` | Seated with bent knees, transitions to standing |
| 2 | WALKING_STUMBLE | `WALK_STRIDE_JOINTS` | Mid-stride asymmetric pose |
| 3 | STANDING_SWAY | `BASE_JOINTS` | Upright standing, sway escalates |
| 4 | SUDDEN_COLLAPSE | `BASE_JOINTS` | Rapid tilt from upright to near-fallen |
| 5 | NIGHT_CONFUSED | `WALK_STRIDE_JOINTS` | Shuffling disoriented movement |

### Phase Structure (per scenario)

Each scenario has **5 phases** of keyframes. **Only 4 are shown in the UI** (Recovery is excluded from the phase step buttons):

| Phase | Frames | Stage Label | Color |
|---|---|---|---|
| Normal | 8 | e.g. "Rising from Bed" | `#14B8A6` (teal) |
| Early Signs | 9 | e.g. "Balance Unstable" | `#F59E0B` (amber) |
| High Risk | 7 | e.g. "RISK: Losing Balance" | `#EF4444` (red) |
| Near-Fall | 6 | e.g. "⚠ NEAR FALL" | `#EF4444` (red) |
| Recovery | 10 | (stored but not displayed) | `#F59E0B` (amber) |

**Total per scenario: 40 keyframes.** The UI plays frames 0–29 only.

### Scenario-Specific Base Poses

The key innovation for realistic poses: each scenario phase carries `baseJoints` — a set of joint coordinates that define the figure's shape *before* tilt/sway is applied.

| Pose Constant | Description | Used By |
|---|---|---|
| `BASE_JOINTS` | Upright standing figure (default) | STANDING_SWAY, SUDDEN_COLLAPSE |
| `LYING_JOINTS` | Horizontal figure (head left, feet right) | BED_RISE Normal + Early |
| `BED_SITTING_JOINTS` | Seated at bed edge, legs hanging | BED_RISE High + Near-Fall |
| `SEATED_JOINTS` | Chair seated, knees at 90° | CHAIR_STAND Normal + Early |
| `WALK_STRIDE_JOINTS` | Mid-stride, asymmetric arms + legs | WALKING_STUMBLE, NIGHT_CONFUSED |
| `RISING_JOINTS` | Torso pitched forward, pushing to stand | CHAIR_STAND variants |

**LYING_JOINTS geometry trick:** At tilt=0° the figure is completely flat. As tilt increases from 0° → 90°, the rotation transform naturally raises the figure to upright. This makes Bed Rise the only scenario to show a true horizontal-to-vertical transition in the animation.

### Frame Generation — `expandScenario(phases, dir)`

Expands 5 phase specs into a flat array of 40 `Frame` objects using linear interpolation:

```typescript
const lerp = (a, b) => a + (b - a) * p   // p = progress within phase (0→1)
// Adds sinusoidal oscillation for natural wobble
const osc = Math.sin(frames.length * 0.9) * oscAmp
// oscAmp: critical=2.5, high=1.5, early=0.8, normal=0.2
```

Each frame stores: `t` (ms) · `tilt` · `swayX` · `swayY` · `risk` · `confidence` · `speed` · `unstable[]` · `stageLabel` · `stageColor` · `baseJoints?`

### Joint Position Calculation — `computeJoints(frame, noise)`

```typescript
const joints = frame.baseJoints ?? BASE_JOINTS
const tiltRad = (frame.tilt * Math.PI) / 180
// Rotate each joint around the hip centre (50, 52)
dx = bx - 50;  dy = by - 52
rx = dx*cos(tilt) - dy*sin(tilt)
ry = dx*sin(tilt) + dy*cos(tilt)
// Add horizontal sway + vertical compression + noise jitter
x = (50 + swayX*0.3) + rx + jitter
y = 52 + ry + swayY*0.2 + jitter
```

This single function handles all 6 scenario poses because `baseJoints` defines the shape and tilt defines the lean.

### Patient → Scenario Mapping

```typescript
const num = parseInt(patientId.replace(/\D/g, ''))   // e.g. P003 → 3
const sid = num % 6                                   // 0–5 scenario index
const dir = num % 2 === 0 ? 1 : -1                   // sway direction L or R
```

Patients with even IDs sway right; odd IDs sway left. Ensures visual variety across the patient grid.

### SkeletonSVG Renderer

```tsx
<svg viewBox="0 0 100 100">
  {/* Background glow */}
  <rect fill="url(#radialGradient)" />
  {/* Shadow ellipse (shifts with swayX) */}
  <ellipse cy={96} opacity={0.18} />
  {/* Bones — dimmed unless either endpoint joint is unstable */}
  {BONES.map(([a,b]) => <line opacity={hot ? 0.95 : 0.35} />)}
  {/* Joint dots — larger + glowing if unstable */}
  {Object.entries(joints).map(([name, pos]) => <circle />)}
  {/* Sway arrow — visible when |swayX| > 3 */}
  {Math.abs(frame.swayX) > 3 && <line stroke="#F59E0B" strokeDasharray="3 2" />}
</svg>
```

---

## 10. Chart Components

**File:** `components/Charts.tsx`

All charts are pure SVG with no third-party charting library.

### DonutChart

Renders risk distribution as a segmented ring.

```tsx
<DonutChart
  segments={[
    { label: 'Low',      value: 11, color: '#14B8A6' },
    { label: 'Moderate', value: 8,  color: '#F59E0B' },
    { label: 'High',     value: 5,  color: '#EF4444' },
  ]}
  size={160}
  thickness={28}
  centerLabel="24"
/>
```

Uses SVG `<path>` with computed arc coordinates from segment angles.

### Sparkline

10-point mini trend line. Used in stat cards and the Progressive Risk Indicator.

```tsx
<Sparkline data={patient.trend} color="#EF4444" width={60} height={20} filled />
```

`filled=true` adds a gradient area under the line.

### LineChart

Multi-line time series with grid lines and axis labels.

```tsx
<LineChart
  data={{ labels: ['Mon','Tue',...], values: [[2,4,3,...], [5,6,7,...]] }}
  width={400} height={160}
/>
```

### BarChart

Stacked horizontal bars for risk distribution per day.

```tsx
<BarChart
  data={[{ label:'Mon', low:6, moderate:4, high:2 }, ...]}
  width={350} height={140}
/>
```

### RiskArc

A 200° arc gauge displaying a single risk score. Used in PatientDetailPanel Live View and the Progressive Risk Indicator cards.

```tsx
<RiskArc score={82} size={100} />
```

Color: teal (< 41) · amber (41–70) · red (> 70).

### MiniArea

Gradient area chart for compact sparkline with fill. Used in report stat cards.

### HBar

Horizontal progress bar with label. Used in room occupancy displays.

---

## 11. Type Definitions

**File:** `types/index.ts`

### Union Types

```typescript
type RiskLevel     = 'Low Risk' | 'Moderate Risk' | 'High Risk'
type PostureType   = 'Lying' | 'Sitting' | 'Standing' | 'Walking'
type PatientStatus = 'Normal' | 'Monitoring' | 'Alert' | 'Recovery'
type AlertStatus   = 'New' | 'Acknowledged' | 'Resolved'
type FallTab       = 'dashboard' | 'room-overview' | 'alerts-risk' | 'event-replay' | 'reports' | 'settings'
type PatientDetailTab = 'overview' | 'live-view' | 'history' | 'replay' | 'analytics'
```

### Patient Interface

```typescript
interface Patient {
  id:          string       // 'P001' – 'P024'
  name:        string
  age:         number
  gender:      'Male' | 'Female'
  room:        string       // 'Room 01' | 'Room 02'
  bed:         string       // 'Bed 1' – 'Bed 12'
  posture:     PostureType
  riskLevel:   RiskLevel
  riskScore:   number       // 5–98
  confidence:  number       // 0.60–0.99
  trend:       number[]     // 10 recent scores
  lastUpdated: string       // 'HH:MM AM/PM'
  status:      PatientStatus
}
```

### FallAlert Interface

```typescript
interface FallAlert {
  id:          string
  patientId:   string
  patientName: string
  room:        string
  bed:         string
  riskLevel:   RiskLevel
  alertType:   string       // 'Risk Escalation' | 'Abnormal Posture' | ...
  description: string
  time:        string
  status:      AlertStatus
}
```

### RoomData Interface

```typescript
interface RoomData {
  name:          string
  totalBeds:     number
  bedsOccupied:  number
  alerts:        number
  riskBreakdown: { low: number; moderate: number; high: number }
}
```

---

## 12. Styling System

### Tailwind CSS (v4)

Used for layout, spacing, flex/grid utilities, and hover states in structural components.

```tsx
<div className="flex items-center gap-4 px-6 py-3 bg-white border-b">
```

### Inline Style Props

Used for all dynamic, data-driven styles — colors that depend on risk level, widths from percentage calculations, conditional borders.

```tsx
<div style={{
  background: `${riskColor}12`,           // tinted background
  border: `1px solid ${riskColor}30`,     // tinted border
  color: riskColor,
  width: `${(occupied / total) * 100}%`,  // dynamic bar width
}}>
```

### CSS Modules

Used only in layout-level components (`MainLayout.tsx`, `Sidebar.tsx`) for scoped class names.

### Helper Functions

```typescript
const riskColor  = (l: string) =>
  l === 'High Risk' ? '#EF4444' : l === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'

const scoreColor = (s: number) =>
  s >= 71 ? '#EF4444' : s >= 41 ? '#F59E0B' : '#14B8A6'
```

These are defined at the top of each component file that needs them (not centralised, to keep components self-contained).

---

## 13. Color Palette & Visual Language

### Brand Colors

| Color | Hex | Usage |
|---|---|---|
| Navy | `#1E3A8A` | Primary UI, active tab buttons |
| Blue | `#2563EB` | Secondary accents, room filter buttons |
| Teal | `#14B8A6` | Low Risk, Normal stage, success states |
| Amber | `#F59E0B` | Moderate Risk, Early Signs stage, warnings |
| Red | `#EF4444` | High Risk, Near-Fall stage, critical alerts |
| Purple | `#7C3AED` | ST-GCN badge, Bed Event category |
| Slate | `#475569` | Night/Confusion category |

### Transparency Convention

| Usage | Opacity suffix |
|---|---|
| Card tinted background | `color + '12'` (≈ 7% opacity) |
| Tinted border | `color + '25'` (≈ 15%) or `'30'` (≈ 19%) |
| Glow effect on skeleton | `color + '70'` (≈ 44%) |
| SVG overlay glow | `color + '20'` (≈ 12%) |
| Dark section badge | `color + '22'` (≈ 13%) |

### Risk-to-Color Mapping

The same 3-way mapping is used universally:
- Score 0–40 → Teal (Low)
- Score 41–70 → Amber (Moderate)
- Score 71–100 → Red (High)

### Skeleton Stage Colors

| Stage | Color |
|---|---|
| Normal | `#14B8A6` teal |
| Early Signs | `#F59E0B` amber |
| High Risk | `#EF4444` red |
| Near-Fall | `#EF4444` red |

---

## 14. Key Algorithms & Logic

### Risk Level Classification

```typescript
score > 70  → 'High Risk'
score > 40  → 'Moderate Risk'
else        → 'Low Risk'
```

### Live Tick (every 2500ms)

```typescript
function tick() {
  const delta = (Math.random() - 0.45) * 8   // slight upward bias
  const newScore = clamp(oldScore + delta, 5, 98)
  if (newScore > 71 && oldScore <= 71) {
    // Patient just crossed High Risk threshold → create new alert
    alerts.unshift({ type: 'Risk Escalation', status: 'New', ... })
  }
  trend = [...trend.slice(-9), newScore]       // keep last 10
  confidence = clamp(conf + (Math.random()-0.5)*0.05, 0.60, 0.99)
}
```

### Ward Status Derivation (Reports)

```typescript
const highCount = patients.filter(p => p.riskLevel === 'High Risk').length
const wardStatus = highCount === 0 ? 'STABLE' : highCount <= 3 ? 'CAUTION' : 'CRITICAL'
```

### Period-Scaled Report Stats

```typescript
const scale = PERIOD_SCALE[reportType]
const totalAlerts = Math.round(baseAlerts * scale.alertMult)
const totalFalls  = Math.round(baseFalls  * scale.fallMult)
const totalEvents = Math.round(baseEvents * scale.eventMult)
```

### Skeleton Tilt Rotation

The 2D rotation used to tilt the skeleton figure:

```
rx = dx·cos(θ) − dy·sin(θ)
ry = dx·sin(θ) + dy·cos(θ)
```

where `dx, dy` are offsets from the hip centre `(50, 52)` and `θ = tilt° × π/180`.

### Stage Detection During Playback

```typescript
const stageIdx = Math.max(0, STAGE_JUMPS.findIndex((s, i) =>
  frameIdx >= s.start &&
  (i === STAGE_JUMPS.length - 1 || frameIdx < STAGE_JUMPS[i + 1].start)
))
```

Returns 0–3 (no Recovery in STAGE_JUMPS). Used to highlight the active phase button.

---

## 15. Component Interaction Map

```
FallDetectionPage
  ├── reads:   alerts, patients        ← useFallStore
  ├── calls:   startLive()             ← useFallStore (onMount)
  ├── renders: tab components
  └── opens:   PatientDetailPanel      ← via selectedPatient state

DashboardTab
  ├── reads:  patients, alerts         ← useFallStore
  ├── calls:  acknowledgeAlert         ← useFallStore
  └── opens:  PatientDetailPanel       ← via onSelectPatient prop

RoomOverviewTab
  ├── reads:  patients                 ← useFallStore
  ├── reads:  ROOMS                    ← mockData (static)
  └── opens:  PatientDetailPanel       ← via onSelectPatient prop

AlertsRiskTab
  ├── reads:  alerts, patients         ← useFallStore
  ├── calls:  acknowledgeAlert,
  │           resolveAlert             ← useFallStore
  └── opens:  PatientDetailPanel       ← via onSelectPatient prop

EventReplayTab
  ├── reads:  patients                 ← useFallStore
  ├── reads:  PATIENT_HISTORY          ← mockData (static)
  ├── calls:  getPatientScenario       ← skeletonScenarios
  └── renders: SkeletonSVG             ← local, uses computeJoints

ReportsTab
  ├── reads:  patients                 ← useFallStore
  ├── reads:  ROOMS                    ← mockData (static)
  └── exports: PDF via window.print()
              CSV via Blob URL

PatientDetailPanel
  ├── receives: patient                ← prop from FallDetectionPage
  ├── calls:  getPatientScenario       ← skeletonScenarios
  ├── calls:  computeJoints            ← skeletonScenarios
  ├── calls:  getLiveActivity          ← skeletonScenarios
  └── reads:  PATIENT_HISTORY          ← mockData (static)
```

---

*Generated for the R26-DS-010 Intelligent Care Support project — Fall Detection Frontend.*
