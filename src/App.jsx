import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import Home from "./Home";
import AIChat from "./AIChat";
import AIImage from "./AIImage";
import Projects from "./Projects";
import Settings from "./Settings";
import Login from "./Login";
import Signup from "./Signup";
import NewCampaign from "./NewCampaign";
import CampaignResults from "./CampaignResults";

import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";

import { supabase } from "./supabaseClient";

function LoadingScreen({ message = "Loading Droxion..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0e0e10] text-white">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-blue-500" />

        <p className="mt-4 text-sm text-gray-400">
          {message}
        </p>
      </div>
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

  return children || <Outlet />;
}

function PublicRoute({ session, loading, children }) {
  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
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
          console.error(
            "Failed to load Supabase session:",
            error
          );
        }

        if (mounted) {
          setSession(currentSession);
          setAuthLoading(false);
        }
      } catch (error) {
        console.error(
          "Unexpected authentication error:",
          error
        );

        if (mounted) {
          setSession(null);
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const startTime = Date.now();

    const handleUnload = () => {
      const duration = Math.floor(
        (Date.now() - startTime) / 1000
      );

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

        const beaconSent = navigator.sendBeacon(
          trackingUrl,
          blob
        );

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

    window.addEventListener(
      "beforeunload",
      handleUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleUnload
      );
    };
  }, [session]);

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white">
      <Routes>
        {/* Public homepage */}
        <Route path="/" element={<Home />} />

        {/* Authentication */}
        <Route
          path="/login"
          element={
            <PublicRoute
              session={session}
              loading={authLoading}
            >
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicRoute
              session={session}
              loading={authLoading}
            >
              <Signup />
            </PublicRoute>
          }
        />

        {/* Protected professional workspace */}
        <Route
          element={
            <ProtectedRoute
              session={session}
              loading={authLoading}
            >
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/new-campaign"
            element={<NewCampaign />}
          />

          <Route
            path="/projects"
            element={<Projects />}
          />

          <Route
            path="/campaign-results"
            element={<CampaignResults />}
          />

          <Route
            path="/campaign-results/:id"
            element={<CampaignResults />}
          />

          <Route
            path="/ai-image"
            element={<AIImage />}
          />

          <Route
            path="/settings"
            element={<Settings />}
          />
        </Route>

        {/* AI Chat remains full screen for now */}
        <Route
          path="/chatboard"
          element={
            <ProtectedRoute
              session={session}
              loading={authLoading}
            >
              <AIChat />
            </ProtectedRoute>
          }
        />

        {/* Redirect old routes */}
        <Route
          path="/smart"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/generator"
          element={
            <Navigate
              to="/new-campaign"
              replace
            />
          }
        />

        <Route
          path="/templates"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/connect"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/editor"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/analytics"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/plans"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* Unknown page */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                authLoading
                  ? "/"
                  : session
                    ? "/dashboard"
                    : "/"
              }
              replace
            />
          }
        />
      </Routes>
    </div>
  );
}
