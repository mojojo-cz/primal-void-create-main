import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ScrollToTop from "@/components/ScrollToTop";

import AuthLayout from "./pages/auth/AuthLayout";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import CourseManagement from "./pages/admin/CourseManagement";
import VideoManagement from "./pages/admin/VideoManagement";
import AccountManagement from "./pages/admin/AccountManagement";
import Settings from "./pages/admin/Settings";
import StudentPage from "./pages/StudentPage";
import CourseStudyPage from "./pages/CourseStudyPage";
import ColorShowcase from "./pages/ColorShowcase";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
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
            
            {/* 班主任路由 */}
            <Route 
              path="/teacher" 
              element={
                <ProtectedRoute allowedUserTypes={["head_teacher", "business_teacher"]}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* 正式学员路由 */}
            <Route 
              path="/student" 
              element={
                <ProtectedRoute allowedUserTypes={["student", "trial_user"]}>
                  <StudentPage />
                </ProtectedRoute>
              } 
            />
            
            {/* 课程学习页面 */}
            <Route 
              path="/student/course/:courseId" 
              element={
                <ProtectedRoute allowedUserTypes={["student", "trial_user"]}>
                  <CourseStudyPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedUserTypes={["admin", "head_teacher", "business_teacher"]}>
                  <AdminLayout />
                </ProtectedRoute>
              } 
            >
              <Route index element={<Navigate to="/admin/courses" replace />} />
              <Route path="courses" element={<CourseManagement />} />
              <Route path="videos" element={<VideoManagement />} />
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
