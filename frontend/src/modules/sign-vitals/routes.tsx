import { Route } from 'react-router-dom'
import Overview from './pages/Overview'
import ParkinsonsEducation from './pages/ParkinsonsEducation'
import SignLanguage from './pages/SignLanguage'

export const SignVitalsRoutes = (
  <Route path="sign-vitals">
    <Route index element={<Overview />} />
    <Route path="parkinsons" element={<ParkinsonsEducation />} />
    <Route path="sign-language" element={<SignLanguage />} />
  </Route>
)
