import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  currentUser,
  getBearerToken,
  loadOmadaConfig,
  signIn,
  signOut,
  type BackendUser,
} from "../../services/backendClient";
import { AuthContext } from "./authContext";
import { ApiErrorDialog } from "./ApiFeedback";
export default function BackendGate({
  children,
}: {
  children: (user: BackendUser) => ReactNode;
}) {
  const [user, setUser] = useState<BackendUser>(),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const expired = () => setUser(undefined);
    window.addEventListener("backend-session-expired", expired);
    const restore = async () => {
      try {
        if (getBearerToken()) {
          const u = await currentUser();
          await loadOmadaConfig();
          if (mounted) setUser(u);
        }
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void restore();
    return () => {
      mounted = false;
      window.removeEventListener("backend-session-expired", expired);
    };
  }, []);
  if (loading)
    return (
      <Stack alignItems="center" sx={{ pt: 12 }}>
        <CircularProgress />
      </Stack>
    );
  if (!user)
    return (
      <Stack justifyContent="center" sx={{ minHeight: "100vh", p: 3 }}>
        <Paper
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 440,
            boxSizing: "border-box",
            mx: "auto",
          }}
        >
          <Typography variant="h4">UFO Partner</Typography>
          <Typography color="text.secondary" mt={1}>
            Sign in with your account.
          </Typography>
          <Stack
            component="form"
            spacing={2}
            mt={3}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const u = await signIn(email, password);
                await loadOmadaConfig();
                setUser(u);
                setPassword("");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <ApiErrorDialog
              error={error}
              onClose={() => setError("")}
              title="Unable to sign in"
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              required
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              required
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  return (
    <AuthContext.Provider
      value={{
        user,
        logout: async () => {
          await signOut();
          setUser(undefined);
        },
      }}
    >
      {children(user)}
    </AuthContext.Provider>
  );
}
