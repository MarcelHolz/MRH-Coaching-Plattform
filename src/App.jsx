import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import CoachieLayout from './layouts/CoachieLayout'
import CoachieDashboardPage from './pages/CoachieDashboardPage'
import CoachieProgramPage from './pages/CoachieProgramPage'

import { AdminAuthProvider } from './admin/AdminAuthContext'
import AdminProtectedRoute from './admin/AdminProtectedRoute'
import AdminLoginPage from './admin/AdminLoginPage'
import AdminLayout from './admin/AdminLayout'
import AdminProgrammePage from './admin/AdminProgrammePage'
import AdminProgramDetailPage from './admin/AdminProgramDetailPage'
import AdminCoachiesPage from './admin/AdminCoachiesPage'
import AdminProgressPage from './admin/AdminProgressPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/coachie"
              element={
                <ProtectedRoute>
                  <CoachieLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CoachieDashboardPage />} />
              <Route path="programme/:programId" element={<CoachieProgramPage />} />
            </Route>

            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminLayout />
                </AdminProtectedRoute>
              }
            >
              <Route index element={<Navigate to="programme" replace />} />
              <Route path="programme" element={<AdminProgrammePage />} />
              <Route
                path="programme/:programId"
                element={<AdminProgramDetailPage />}
              />
              <Route path="coachies" element={<AdminCoachiesPage />} />
              <Route path="fortschritt" element={<AdminProgressPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
