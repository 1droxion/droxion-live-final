import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import SmartBar from "./SmartBar";
import Generator from "./Generator";
import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Plans from "./Plans";
import Projects from "./Projects";
import Templates from "./Templates";
import Connect from "./Connect";
import Editor from "./Editor";
import Settings from "./Settings";
import Login from "./Login";
import Signup from "./Signup";
import Analytics from "./Analytics";
import NewCampaign from "./NewCampaign";
import CampaignResults from "./CampaignResults";
import { supabase } from "./supabaseClient";

function LoadingScreen({ message = "Loading Droxion..." }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e10] text-white">
      {message}
    </div>
  );
}

function ProtectedRoute({ session, loading, children }) {
  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ session, loading, children }) {
  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Failed to load Supabase session:", error);
        }

        if (mounted) {
          setSession(currentSession);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error("Unexpected authentication error:", error);

        if (mounted) {
          setSession(null);
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const startTime = Date.now();

    const handleUnload = () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);

      const backendUrl =
        import.meta.env.VITE_BACKEND_URL ||
        "https://droxion-backend.onrender.com";

      const trackingUrl = `${backendUrl}/track`;

      const payload = JSON.stringify({
        event: "session_time",
        path: window.location.pathname,
        duration,
        userAgent: navigator.userAgent,
        user_id: session?.user?.id || null,
      });

      try {
        const blob = new Blob([payload], {
          type: "application/json",
        });

        const beaconSent = navigator.sendBeacon(trackingUrl, blob);

        if (!beaconSent) {
          fetch(trackingUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        fetch(trackingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [session]);

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white">
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute session={session} loading={authLoading}>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicRoute session={session} loading={authLoading}>
              <Signup />
            </PublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <AIChat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <AIChat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chatboard"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <AIChat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/smart"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <SmartBar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/generator"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Generator />
            </ProtectedRoute>
          }
        />

        <Route
          path="/new-campaign"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <NewCampaign />
            </ProtectedRoute>
          }
        />

        <Route
          path="/campaign-results"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <CampaignResults />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-image"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <AIImage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plans"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Plans />
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Projects />
            </ProtectedRoute>
          }
        />

        <Route
          path="/templates"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Templates />
            </ProtectedRoute>
          }
        />

        <Route
          path="/connect"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Connect />
            </ProtectedRoute>
          }
        />

        <Route
          path="/editor"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Editor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute session={session} loading={authLoading}>
              <Analytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to={session ? "/" : "/login"} replace />}
        />
      </Routes>
    </div>
  );
}
