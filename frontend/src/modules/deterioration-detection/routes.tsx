import { Route } from 'react-router-dom'
import Overview from './pages/Overview'
import { DeteriorationDataProvider } from './context/DeteriorationDataContext'

export const DeteriorationRoutes = (
  <Route
    path="deterioration"
    element={
      <DeteriorationDataProvider>
        <Overview />
      </DeteriorationDataProvider>
    }
  />
)
