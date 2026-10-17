import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallHint } from "@/components/PWAInstallHint";
import { AppToolbar } from "@/components/AppToolbar";
import { VoiceProvider } from "@/components/VoiceProvider";
import More from "./pages/More";
import { PWAUpdateNotice } from "@/components/PWAUpdateNotice";
import { PendingNotifications } from "@/components/PendingNotifications";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Leisure from "./pages/Leisure";
import ShoppingList from "./pages/ShoppingList";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import AuthConfirm from "./pages/AuthConfirm";
import CalendarEvent from "./pages/CalendarEvent";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <Toaster />
            <Sonner position="top-center" />
            <PWAInstallHint />
            <PWAUpdateNotice />
            <PendingNotifications />
            <BrowserRouter>
              <VoiceProvider>
              <AppToolbar />
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/confirm" element={<AuthConfirm />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/calendar-event" element={<CalendarEvent />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <Transactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budgets"
                element={
                  <ProtectedRoute>
                    <Budgets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/festometro"
                element={
                  <ProtectedRoute>
                    <Leisure />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shopping-list"
                element={
                  <ProtectedRoute>
                    <ShoppingList />
                  </ProtectedRoute>
                }
              />
              <Route path="/leisure" element={<Navigate to="/festometro" replace />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
              </VoiceProvider>
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </TooltipProvider>
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
