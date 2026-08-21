import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { BASE_PATH } from './lib/api';
import Layout from './components/Layout';
import { Spinner } from './components/ui/spinner';
import { Toaster } from './components/ui/sonner';
import Login from './pages/Login';
import Classes from './pages/Classes';
import Students from './pages/Students';
import Assignments from './pages/Assignments';
import AssignmentDetail from './pages/AssignmentDetail';
import Scan from './pages/Scan';
import Users from './pages/Users';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={BASE_PATH}>
        <Toaster />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/scan/:assignmentId"
            element={
              <Protected>
                <Scan />
              </Protected>
            }
          />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Navigate to="/assignments" replace />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/students" element={<Students />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/assignments/:id" element={<AssignmentDetail />} />
            <Route path="/users" element={<Users />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
