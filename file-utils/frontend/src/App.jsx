import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Auth from "./pages/Auth";
import AppLayout from "./layout/AppLayout";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

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
    <AppLayout session={session}>
      <Routes>
        {/* Landing */}
        <Route
          path="/"
          element={
            session ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Landing />
            )
          }
        />

        {/* Auth Page */}
        <Route
          path="/auth"
          element={
            !session ? (
              <Auth />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Protected Dashboard */}
        <Route
          path="/dashboard"
          element={
            session ? (
              <Dashboard session={session} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />

        {/* Protected Upload */}
        <Route
          path="/upload"
          element={
            session ? (
              <Upload session={session} />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
      </Routes>
    </AppLayout>
  );
}