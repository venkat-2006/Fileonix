import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Auth Page */}
      <Route
        path="/"
        element={
          !session ? <Auth /> : <Navigate to="/dashboard" replace />
        }
      />

      {/* Protected Dashboard */}
      <Route
        path="/dashboard"
        element={
          session ? <Dashboard /> : <Navigate to="/" replace />
        }
      />
    </Routes>
  );
}