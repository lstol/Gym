import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './data/auth'
import { ProtectedRoute } from './ui/ProtectedRoute'
import { PublicOnlyRoute } from './ui/PublicOnlyRoute'
import { LoginPage } from './ui/LoginPage'
import { SignupPage } from './ui/SignupPage'
import { ChangePasswordPage } from './ui/ChangePasswordPage'
import { HomePage } from './features/progress/HomePage'
import { SettingsPage } from './features/settings/SettingsPage'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
