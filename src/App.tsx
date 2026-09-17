import { useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import WifiIcon from "@mui/icons-material/WifiOutlined";
import ScheduleIcon from "@mui/icons-material/ScheduleOutlined";
import PortalIcon from "@mui/icons-material/LanguageOutlined";
import VoucherIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import WifiPage from "./pages/WifiPage";
import SchedulePage from "./pages/SchedulePage";
import PortalPage from "./pages/PortalPage";
import VoucherPage from "./pages/VoucherPage";
import {
  ensureAccessToken,
  getSiteId,
  setSiteId,
} from "./services/omadaClient";
const location = import.meta.env.VITE_LOCATION_NAME || "UFO Test Location";
const links = [
  ["Dashboard", "/", <DashboardIcon />],
  ["WiFi Networks", "/wifi", <WifiIcon />],
  ["Schedules", "/schedules", <ScheduleIcon />],
  ["Portals", "/portals", <PortalIcon />],
  ["Vouchers", "/vouchers", <VoucherIcon />],
] as const;
export default function App() {
  const [tokenOpen, setTokenOpen] = useState(true),
    [authReady, setAuthReady] = useState(false),
    [authError, setAuthError] = useState("");
  const connected = () => {
    setTokenOpen(false);
    setAuthError("");
    setAuthReady(true);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">U</div>
          <span>UFO Partner</span>
        </div>
        <nav className="nav">
          {links.map(([label, to, icon]) => (
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
            Active site<strong>{location}</strong>
          </div>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setTokenOpen(true)}
            >
              API access
            </Button>
            <Avatar
              sx={{ width: 34, height: 34, bgcolor: "#0b91cf", fontSize: 14 }}
            >
              UP
            </Avatar>
          </Stack>
        </header>
        <Box className="content">
          {authReady ? (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/wifi" element={<WifiPage />} />
              <Route path="/schedules" element={<SchedulePage />} />
              <Route path="/portals" element={<PortalPage />} />
              <Route path="/vouchers" element={<VoucherPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          ) : (
            <Stack alignItems="center" spacing={2} sx={{ py: 12 }}>
              <CircularProgress />
              <Typography color="text.secondary">
                Connecting to Omada…
              </Typography>
              {authError && <Alert severity="error">{authError}</Alert>}
            </Stack>
          )}
        </Box>
      </main>
      <StartupDialog open={tokenOpen} onConnected={connected} />
    </div>
  );
}
function Dashboard() {
  return (
    <>
      <Typography variant="h4">Operations overview</Typography>
      <Typography color="text.secondary" mt={0.5}>
        Manage services for {location}.
      </Typography>
      <div className="stat-grid">
        {[
          ["WiFi Networks", "Live Omada inventory"],
          ["Schedules", "Reusable access windows"],
          ["Portals", "Guest authentication"],
          ["Vouchers", "Controlled guest access"],
        ].map(([a, b]) => (
          <Paper className="stat-card" key={a}>
            <div className="stat-label">{b}</div>
            <div className="stat-number">{a}</div>
          </Paper>
        ))}
      </div>
      <Paper sx={{ mt: 3, p: 3 }}>
        <Typography variant="h6">Getting started</Typography>
        <List>
          <ListItem>
            <ListItemText
              primary="1. Add an Omada API access token"
              secondary="Stored only for this browser session."
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="2. Verify schedules and WiFi networks"
              secondary="Schedules can be assigned directly from a WiFi row."
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="3. Create a portal and voucher group"
              secondary="Voucher portals use real SSID and portal IDs from Omada."
            />
          </ListItem>
        </List>
      </Paper>
    </>
  );
}
function StartupDialog({
  open,
  onConnected,
}: {
  open: boolean;
  onConnected: () => void;
}) {
  const [site, setSite] = useState(getSiteId()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const connect = async () => {
    if (!site.trim()) return;
    setBusy(true);
    setError("");
    try {
      setSiteId(site);
      await ensureAccessToken();
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect to Omada.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} fullWidth maxWidth="sm">
      <DialogTitle>Connect to Omada</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography color="text.secondary">
            Confirm the Omada site to manage. The test application credentials
            are configured automatically, and expired access tokens are renewed.
          </Typography>
          <TextField
            label="Site ID"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            autoComplete="off"
            autoFocus
            helperText="Change this only when connecting to a different Omada site."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {authReadyFromSession() && (
          <Button onClick={onConnected}>Cancel</Button>
        )}
        <Button
          variant="contained"
          disabled={busy || !site.trim()}
          onClick={connect}
        >
          {busy ? <CircularProgress size={20} color="inherit" /> : "Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function authReadyFromSession() {
  return !!sessionStorage.getItem("omadaAccessToken");
}
