import { lazy, Suspense } from 'react'
import { Route } from 'react-router-dom'
import Overview from './pages/Overview'
import ParkinsonsEducation from './pages/ParkinsonsEducation'
import SignLanguage from './pages/SignLanguage'

// Dev-only motion review page; `import.meta.env.DEV` is false in production
// builds, so this import (and the review videos it globs) is dropped.
const MotionReview = import.meta.env.DEV ? lazy(() => import('./dev/MotionReview')) : null

export const SignVitalsRoutes = (
  <Route path="sign-vitals">
    <Route index element={<Overview />} />
    <Route path="parkinsons" element={<ParkinsonsEducation />} />
    <Route path="sign-language" element={<SignLanguage />} />
    {MotionReview && (
      <Route path="dev/motion-review" element={<Suspense fallback={null}><MotionReview /></Suspense>} />
    )}
  </Route>
)
