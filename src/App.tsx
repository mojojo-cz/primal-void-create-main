import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

import AuthLayout from "./pages/auth/AuthLayout";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import CourseManagement from "./pages/admin/CourseManagement";
import VideoManagement from "./pages/admin/VideoManagement";
import MinIOVideoManagement from "./pages/admin/MinIOVideoManagement";
import AccountManagement from "./pages/admin/AccountManagement";
import Settings from "./pages/admin/Settings";
import StudentPage from "./pages/StudentPage";
import ColorShowcase from "./pages/ColorShowcase";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/auth/login" replace />} />
            
            {/* Auth Routes */}
            <Route path="/auth" element={<AuthLayout />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* 教师路由 */}
            <Route 
              path="/teacher" 
              element={
                <ProtectedRoute allowedUserTypes={["teacher"]}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* 学员路由 */}
            <Route 
              path="/student" 
              element={
                <ProtectedRoute allowedUserTypes={["student"]}>
                  <StudentPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedUserTypes={["admin", "teacher"]}>
                  <AdminLayout />
                </ProtectedRoute>
              } 
            >
              <Route index element={<Navigate to="/admin/courses" replace />} />
              <Route path="courses" element={<CourseManagement />} />
              <Route path="videos" element={<VideoManagement />} />
              <Route path="minio-videos" element={<MinIOVideoManagement />} />
              <Route path="accounts" element={<AccountManagement />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* Color Showcase Route */}
            <Route path="/colors" element={<ColorShowcase />} />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
