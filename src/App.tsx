import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Todos from './pages/Todos'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import Notes from './pages/Notes'
import Preservations from './pages/Preservations'
import CalendarPage from './pages/Calendar'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Contracts from './pages/Contracts'
import ContractDetail from './pages/ContractDetail'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/cases" element={<CaseList />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/preservations" element={<Preservations />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/contracts/:id" element={<ContractDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
