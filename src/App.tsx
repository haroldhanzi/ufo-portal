import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { Avatar, Box, Button, Paper, Stack, Typography } from "@mui/material";
import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import WifiIcon from "@mui/icons-material/WifiOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import PortalIcon from "@mui/icons-material/LanguageOutlined";
import VoucherIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import HardwareIcon from "@mui/icons-material/RouterOutlined";
import UsersIcon from "@mui/icons-material/PeopleOutlined";
import BackendGate from "./components/common/BackendGate";
import { useBackendAuth } from "./components/common/authContext";
import { getOmadaConfig } from "./services/backendClient";
import MonitoringPage from "./pages/MonitoringPage";
import UsersPage from "./pages/UsersPage";
import WifiPage from "./pages/WifiPage";
import SchedulePage from "./pages/SchedulePage";
import PortalPage from "./pages/PortalPage";
import VoucherPage from "./pages/VoucherPage";
import UrlFilterPage from "./pages/UrlFilterPage";
const links = [
  ["Dashboard", "/", <DashboardIcon />],
  ["WiFi Networks", "/wifi", <WifiIcon />],
  ["Schedules", "/schedules", <ScheduleIcon />],
  ["Portals", "/portals", <PortalIcon />],
  ["Vouchers", "/vouchers", <VoucherIcon />],
  ["Website Blacklists", "/blacklists", <BlockIcon />],
  ["Hardware Monitoring", "/monitoring", <HardwareIcon />],
  ["Users", "/users", <UsersIcon />],
] as const;
export default function App() {
  return <BackendGate>{() => <AppShell />}</BackendGate>;
}
function AppShell() {
  const { user, logout } = useBackendAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">U</div>
          <span>UFO Partner</span>
        </div>
        <nav className="nav">
          {links
            .filter(([label]) =>
              user.role === "SUPER_ADMIN"
                ? ["Dashboard", "Hardware Monitoring", "Users"].includes(label)
                : true,
            )
            .map(([label, to, icon]) => (
              <NavLink key={to} to={to} end={to === "/"}>
                {icon}
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="location">
            {user.role === "SUPER_ADMIN"
              ? "Super administrator"
              : "Active site"}
            <strong>
              {user.role === "SUPER_ADMIN"
                ? "All sites"
                : getOmadaConfig().siteName}
            </strong>
          </div>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="body2">{user.name}</Typography>
            <Button
              onClick={() => {
                void logout().catch(() => {});
              }}
            >
              Sign out
            </Button>
            <Avatar
              sx={{ width: 34, height: 34, bgcolor: "#0b91cf", fontSize: 14 }}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </Avatar>
          </Stack>
        </header>
        <Box className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wifi" element={<WifiPage />} />
            <Route path="/schedules" element={<SchedulePage />} />
            <Route path="/portals" element={<PortalPage />} />
            <Route path="/vouchers" element={<VoucherPage />} />
            <Route path="/blacklists" element={<UrlFilterPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </main>
    </div>
  );
}
function Dashboard() {
  return (
    <>
      <Typography variant="h4">Operations overview</Typography>
      <Typography color="text.secondary" mt={0.5}>
        Manage services for {getOmadaConfig().siteName}.
      </Typography>
      <div className="stat-grid">
        {[
          ["WiFi Networks", "Live inventory"],
          ["Schedules", "Access windows"],
          ["Portals", "Guest authentication"],
          ["Vouchers", "Guest access"],
          ["Hardware Monitoring", "Device health"],
          ["Users", "Account management"],
        ].map(([name, description]) => (
          <Paper className="stat-card" key={name}>
            <div className="stat-label">{description}</div>
            <div className="stat-number">{name}</div>
          </Paper>
        ))}
      </div>
    </>
  );
}
