import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CreditProvider } from "@/context/CreditContext";
import { AuthModal } from "@/components/AuthModal";
import { PricingModal } from "@/components/PricingModal";
import Landing from "@/pages/Landing";
import Studio from "@/pages/Studio";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CreditProvider>
          <div className="App min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/create" element={<Studio />} />
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
