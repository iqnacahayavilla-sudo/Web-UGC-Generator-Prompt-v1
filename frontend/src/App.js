import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CreditProvider } from "@/context/CreditContext";
import { AuthModal } from "@/components/AuthModal";
import { PricingModal } from "@/components/PricingModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Landing from "@/pages/Landing";
import Studio from "@/pages/Studio";
import LoginPage from "@/pages/LoginPage";
import AdminPage from "@/pages/AdminPage";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CreditProvider>
          <div className="App min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
            <BrowserRouter>
              <Routes>
                {/* Public Invite-Only Login Route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Member Area Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Landing />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create"
                  element={
                    <ProtectedRoute>
                      <Studio />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Super Administrator Route */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminPage />
                    </AdminRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <AuthModal />
            <PricingModal />
            <Toaster position="top-center" richColors />
          </div>
        </CreditProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
