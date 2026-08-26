import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SetPasswordPage from './pages/SetPasswordPage'
import KaufenPage from './pages/KaufenPage'
import KaufErfolgPage from './pages/KaufErfolgPage'
import CoachieLayout from './layouts/CoachieLayout'
import CoachieDashboardPage from './pages/CoachieDashboardPage'
import CoachieProgramPage from './pages/CoachieProgramPage'
import CoachieAuswertungenPage from './pages/CoachieAuswertungenPage'
import TestimonialFormPage from './pages/TestimonialFormPage'

import { AdminAuthProvider } from './admin/AdminAuthContext'
import AdminProtectedRoute from './admin/AdminProtectedRoute'
import AdminLoginPage from './admin/AdminLoginPage'
import AdminLayout from './admin/AdminLayout'
import AdminProgrammePage from './admin/AdminProgrammePage'
import AdminProgramDetailPage from './admin/AdminProgramDetailPage'
import AdminCoachiesPage from './admin/AdminCoachiesPage'
import AdminProgressPage from './admin/AdminProgressPage'
import AdminTestimonialsPage from './admin/AdminTestimonialsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/kaufen/:slug" element={<KaufenPage />} />
            <Route path="/kauf-erfolgreich" element={<KaufErfolgPage />} />
            <Route
              path="/passwort-festlegen"
              element={
                <ProtectedRoute>
                  <SetPasswordPage />
                </ProtectedRoute>
              }
            />

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
              <Route path="auswertungen" element={<CoachieAuswertungenPage />} />
              <Route
                path="testimonial/:programmId"
                element={<TestimonialFormPage />}
              />
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
              <Route path="testimonials" element={<AdminTestimonialsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
