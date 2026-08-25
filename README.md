# CareSense PP2

CareSense PP2 is a caregiver workforce intelligence platform made up of four components:

- **Deterioration detection**
- **Fall detection**
- **Sign & vitals**
- **Voice log**

## Repository structure

- `frontend/` — one shared React app; each component has its own module folder under `src/modules/`.
- `backend_services/<component>/` — each teammate's own FastAPI service for their component.
- `supabase/migrations/` — shared schema, versioned via the Supabase CLI.

## Getting Started

_Placeholder — details to follow._
