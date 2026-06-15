import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/Login'
import AcceptInvitePage from '@/pages/AcceptInvite'
import DashboardPage from '@/pages/Dashboard'
import SettingsPage from '@/pages/Settings'
import TeslaCallbackPage from '@/pages/TeslaCallback'
import DrivesPage from '@/pages/Drives'
import DriveDetailPage from '@/pages/Drives/DriveDetail'
import ChargesPage from '@/pages/Charges'
import ChargeDetailPage from '@/pages/Charges/ChargeDetail'
import AnalyticsPage from '@/pages/Analytics'
import BatteryPage from '@/pages/Battery'
import LocationsPage from '@/pages/Locations'
import GeofencesPage from '@/pages/Geofences'
import UpdatesPage from '@/pages/Updates'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <AcceptInvitePage /> },
  { path: '/tesla/callback', element: <ProtectedRoute><TeslaCallbackPage /></ProtectedRoute> },
  { path: '/settings', element: <ProtectedRoute><SettingsPage /></ProtectedRoute> },
  { path: '/', element: <ProtectedRoute><DashboardPage /></ProtectedRoute> },
  { path: '/drives', element: <ProtectedRoute><DrivesPage /></ProtectedRoute> },
  { path: '/drives/:id', element: <ProtectedRoute><DriveDetailPage /></ProtectedRoute> },
  { path: '/charges', element: <ProtectedRoute><ChargesPage /></ProtectedRoute> },
  { path: '/charges/:id', element: <ProtectedRoute><ChargeDetailPage /></ProtectedRoute> },
  { path: '/analytics', element: <ProtectedRoute><AnalyticsPage /></ProtectedRoute> },
  { path: '/battery', element: <ProtectedRoute><BatteryPage /></ProtectedRoute> },
  { path: '/locations', element: <ProtectedRoute><LocationsPage /></ProtectedRoute> },
  { path: '/geofences', element: <ProtectedRoute><GeofencesPage /></ProtectedRoute> },
  { path: '/updates', element: <ProtectedRoute><UpdatesPage /></ProtectedRoute> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default router
