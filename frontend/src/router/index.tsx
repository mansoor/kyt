import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import SettingsPage from '@/pages/Settings'
import TeslaCallbackPage from '@/pages/TeslaCallback'
import DrivesPage from '@/pages/Drives'
import DriveDetailPage from '@/pages/Drives/DriveDetail'
import ChargesPage from '@/pages/Charges'
import ChargeDetailPage from '@/pages/Charges/ChargeDetail'
import AnalyticsPage from '@/pages/Analytics'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/tesla/callback',
    element: <ProtectedRoute><TeslaCallbackPage /></ProtectedRoute>,
  },
  {
    path: '/settings',
    element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
  },
  {
    path: '/',
    element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
  },
  {
    path: '/drives',
    element: <ProtectedRoute><DrivesPage /></ProtectedRoute>,
  },
  {
    path: '/drives/:id',
    element: <ProtectedRoute><DriveDetailPage /></ProtectedRoute>,
  },
  {
    path: '/charges',
    element: <ProtectedRoute><ChargesPage /></ProtectedRoute>,
  },
  {
    path: '/charges/:id',
    element: <ProtectedRoute><ChargeDetailPage /></ProtectedRoute>,
  },
  {
    path: '/analytics',
    element: <ProtectedRoute><AnalyticsPage /></ProtectedRoute>,
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default router
