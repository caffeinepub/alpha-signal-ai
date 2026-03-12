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
import Sidebar from "./components/Sidebar";
import Charts from "./pages/Charts";
import Dashboard from "./pages/Dashboard";
import Liquidation from "./pages/Liquidation";
import Performance from "./pages/Performance";
import Research from "./pages/Research";
import Signals from "./pages/Signals";

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
};

function AppLayout() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META["/"];

  // Update document title
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

// Define routes
const rootRoute = createRootRoute({
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const chartsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/charts",
  component: Charts,
});

const signalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signals",
  component: Signals,
});

const liquidationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/liquidation",
  component: Liquidation,
});

const performanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/performance",
  component: Performance,
});

const researchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/research",
  component: Research,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  chartsRoute,
  signalsRoute,
  liquidationRoute,
  performanceRoute,
  researchRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
