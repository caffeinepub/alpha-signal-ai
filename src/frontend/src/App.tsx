import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useLocation,
} from "@tanstack/react-router";
import { useEffect } from "react";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import { AuthProvider } from "./hooks/useAuth";
import AdminDashboard from "./pages/AdminDashboard";
import Charts from "./pages/Charts";
import Dashboard from "./pages/Dashboard";
import Liquidation from "./pages/Liquidation";
import LoginPage from "./pages/LoginPage";
import Performance from "./pages/Performance";
import Research from "./pages/Research";
import Signals from "./pages/Signals";
import SignupPage from "./pages/SignupPage";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Market overview and AI trading insights",
  },
  "/charts": {
    title: "Charts",
    subtitle: "Advanced candlestick analysis with EMA overlays",
  },
  "/signals": {
    title: "AI Signals",
    subtitle: "AI-powered trading signals and smart money concepts",
  },
  "/liquidation": {
    title: "Liquidation Heatmap",
    subtitle: "Long & short liquidation zones and market pressure",
  },
  "/performance": {
    title: "Performance",
    subtitle: "Trading analytics and historical performance",
  },
  "/research": {
    title: "Research",
    subtitle: "AI-powered institutional research reports",
  },
  "/admin": {
    title: "Admin Dashboard",
    subtitle: "User management and platform analytics",
  },
};

function AppLayout() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META["/"];

  useEffect(() => {
    document.title = `${meta.title} — Alpha Signal AI`;
  }, [meta.title]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar currentPath={location.pathname} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={meta.title} subtitle={meta.subtitle} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Root route with layout (protected)
const rootRoute = createRootRoute({
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  ),
});

const chartsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/charts",
  component: () => (
    <ProtectedRoute>
      <Charts />
    </ProtectedRoute>
  ),
});

const signalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signals",
  component: () => (
    <ProtectedRoute>
      <Signals />
    </ProtectedRoute>
  ),
});

const liquidationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/liquidation",
  component: () => (
    <ProtectedRoute>
      <Liquidation />
    </ProtectedRoute>
  ),
});

const performanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/performance",
  component: () => (
    <ProtectedRoute>
      <Performance />
    </ProtectedRoute>
  ),
});

const researchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/research",
  component: () => (
    <ProtectedRoute>
      <Research />
    </ProtectedRoute>
  ),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  ),
});

// Auth routes - no layout wrapper needed since they render full-page
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  chartsRoute,
  signalsRoute,
  liquidationRoute,
  performanceRoute,
  researchRoute,
  adminRoute,
  loginRoute,
  signupRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
