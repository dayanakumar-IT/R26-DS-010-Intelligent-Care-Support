// Split into its own file (rather than living alongside
// DeteriorationDataProvider in DeteriorationDataContext.tsx) because a file
// exporting both a component and a hook trips
// react-refresh/only-export-components — mixing them breaks Vite Fast
// Refresh for that file, which would defeat a chunk of the point of this
// caching layer (an edit forcing a full reload during dev wipes the
// in-memory caches this whole module exists to preserve).

import { useContext } from 'react'
import { DeteriorationDataContext } from './contextDefinition'
import type { DeteriorationDataContextValue } from './contextDefinition'

export function useDeteriorationData(): DeteriorationDataContextValue {
  const context = useContext(DeteriorationDataContext)
  if (!context) {
    throw new Error('useDeteriorationData must be used within a DeteriorationDataProvider')
  }
  return context
}
