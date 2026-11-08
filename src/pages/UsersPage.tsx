import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import { useBackendAuth } from "../components/common/authContext";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorDialog, Loading } from "../components/common/ApiFeedback";
import ActionsMenu from "../components/common/ActionsMenu";
import type { BackendUser } from "../services/backendClient";
import { listSites, type OmadaSite } from "../services/siteService";
import {
  createUser,
  listUsers,
  resetUserPassword,
  setUserEnabled,
  updateUser,
  type UserInput,
} from "../services/userService";
export default function UsersPage() {
  return <UserManagement />;
}
function UserManagement() {
  const [rows, setRows] = useState<BackendUser[]>([]),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<BackendUser | "new">(),
    [passwordUser, setPasswordUser] = useState<BackendUser>(),
    [toggleUser, setToggleUser] = useState<BackendUser>();
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await listUsers(page, search);
      setRows(data.content);
      setTotal(data.page.totalElements);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [page, search]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setEditing(undefined);
      setPasswordUser(undefined);
      setToggleUser(undefined);
      setSuccess("Changes saved.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="User Management"
        description="Manage application users and their access."
        addLabel="Create user"
        onAdd={() => setEditing("new")}
        onRefresh={load}
      />
      <ApiErrorDialog error={error} onClose={() => setError("")} />
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}
      <TextField
        label="Search users"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        size="small"
        sx={{ mb: 2 }}
      />
      <Loading show={busy} />
      <Paper
        className="table-wrap"
        role="region"
        aria-label="Users table"
        tabIndex={0}
      >
        <Table>
          <TableHead>
            <TableRow>
              {[
                "Name",
                "Email",
                "Role",
                "Site",
                "Status",
                "Created",
                "Actions",
              ].map((h) => (
                <TableCell key={h}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.role === "SUPER_ADMIN"
                    ? "Super administrator"
                    : "Portal partner"}
                </TableCell>
                <TableCell>
                  {u.role === "SUPER_ADMIN" ? (
                    "All sites"
                  ) : (
                    <>{u.siteName || "Unassigned"}</>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={u.enabled ? "success" : "default"}
                    label={u.enabled ? "Enabled" : "Disabled"}
                  />
                </TableCell>
                <TableCell>
                  {new Date(u.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${u.name}`}
                    items={[
                      {
                        label: "Edit",
                        disabled: busy,
                        onClick: () => setEditing(u),
                      },
                      {
                        label: "Reset password",
                        disabled: busy,
                        onClick: () => setPasswordUser(u),
                      },
                      {
                        label: u.enabled ? "Disable" : "Enable",
                        color: u.enabled ? "error" : "inherit",
                        disabled: busy,
                        onClick: () => setToggleUser(u),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && !busy && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={25}
          rowsPerPageOptions={[25]}
          onPageChange={(_, p) => setPage(p)}
        />
      </Paper>
      {editing && (
        <UserDialog
          user={editing}
          busy={busy}
          onClose={() => setEditing(undefined)}
          onSave={(input, password) =>
            act(() =>
              editing === "new"
                ? createUser({ ...input, password })
                : updateUser(editing.id, input),
            )
          }
        />
      )}
      {passwordUser && (
        <PasswordDialog
          user={passwordUser}
          busy={busy}
          onClose={() => setPasswordUser(undefined)}
          onSave={(p) => act(() => resetUserPassword(passwordUser.id, p))}
        />
      )}
      <Dialog
        open={!!toggleUser}
        onClose={busy ? undefined : () => setToggleUser(undefined)}
      >
        <DialogTitle>
          {toggleUser?.enabled ? "Disable" : "Enable"} {toggleUser?.name}?
        </DialogTitle>
        <DialogContent>
          {toggleUser?.enabled
            ? "This user will lose access immediately."
            : "This user will be able to sign in again."}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setToggleUser(undefined)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              toggleUser &&
              void act(() => setUserEnabled(toggleUser.id, !toggleUser.enabled))
            }
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
function UserDialog({
  user,
  busy,
  onClose,
  onSave,
}: {
  user: BackendUser | "new";
  busy: boolean;
  onClose: () => void;
  onSave: (input: UserInput, password: string) => void;
}) {
  const { user: actor } = useBackendAuth();
  const superAdmin = actor.role === "SUPER_ADMIN";
  const [name, setName] = useState(user === "new" ? "" : user.name),
    [email, setEmail] = useState(user === "new" ? "" : user.email),
    [role, setRole] = useState<UserInput["role"]>(
      user === "new" ? "PORTAL_PARTNER" : user.role,
    ),
    [password, setPassword] = useState("");
  const [siteId, setSiteId] = useState(
    user === "new" ? actor.siteId || "" : user.siteId || "",
  );
  const [sites, setSites] = useState<OmadaSite[]>([]),
    [sitesLoading, setSitesLoading] = useState(true),
    [sitesError, setSitesError] = useState("");
  const refreshSites = useCallback(async () => {
    setSitesLoading(true);
    setSitesError("");
    try {
      setSites(
        superAdmin
          ? await listSites()
          : actor.siteId
            ? [
                {
                  id: actor.siteId,
                  name: actor.siteName || actor.siteId,
                  active: true,
                },
              ]
            : [],
      );
    } catch (err) {
      setSitesError((err as Error).message);
    } finally {
      setSitesLoading(false);
    }
  }, [superAdmin, actor.siteId, actor.siteName]);
  useEffect(() => {
    void refreshSites();
  }, [refreshSites]);
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            {
              name,
              email,
              role,
              siteId: role === "PORTAL_PARTNER" ? siteId : null,
            },
            password,
          );
        }}
      >
        <DialogTitle>
          {user === "new" ? "Create user" : "Edit user"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name"
              value={name}
              required
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              required
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              select
              label="Role"
              value={role}
              disabled={busy}
              onChange={(e) => setRole(e.target.value as UserInput["role"])}
              helperText={
                superAdmin
                  ? "Super administrators manage all sites. Partners manage services, hardware, and users at their assigned site."
                  : "New users receive portal partner access at your assigned site."
              }
            >
              {(superAdmin
                ? ["SUPER_ADMIN", "PORTAL_PARTNER"]
                : ["PORTAL_PARTNER"]
              ).map((r) => (
                <MenuItem key={r} value={r}>
                  {r === "SUPER_ADMIN"
                    ? "Super administrator"
                    : "Portal partner"}
                </MenuItem>
              ))}
            </TextField>
            {role === "PORTAL_PARTNER" && (
              <>
                <ApiErrorDialog
                  error={sitesError}
                  onClose={() => setSitesError("")}
                  title="Unable to load sites"
                />
                <TextField
                  select
                  label="Assigned Omada site"
                  value={sites.some((s) => s.id === siteId) ? siteId : ""}
                  required
                  disabled={busy || sitesLoading || !superAdmin}
                  onChange={(e) => setSiteId(e.target.value)}
                  helperText={
                    sitesLoading
                      ? "Loading sites..."
                      : superAdmin
                        ? "Choose the site this partner can manage."
                        : "Users are assigned to your site automatically."
                  }
                >
                  {sites.map((site) => (
                    <MenuItem key={site.id} value={site.id}>
                      {site.name}
                    </MenuItem>
                  ))}
                </TextField>
                {superAdmin && (
                  <Button
                    disabled={busy || sitesLoading}
                    onClick={refreshSites}
                  >
                    Refresh sites
                  </Button>
                )}
              </>
            )}
            {user === "new" && (
              <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{ htmlInput: { minLength: 12, maxLength: 72 } }}
                helperText="12–72 characters"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              busy ||
              (role === "PORTAL_PARTNER" &&
                (sitesLoading || !sites.some((s) => s.id === siteId)))
            }
          >
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
function PasswordDialog({
  user,
  busy,
  onClose,
  onSave,
}: {
  user: BackendUser;
  busy: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(password);
        }}
      >
        <DialogTitle>Reset password for {user.name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            sx={{ mt: 1 }}
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            disabled={busy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            slotProps={{ htmlInput: { minLength: 12, maxLength: 72 } }}
            helperText="12–72 characters. Existing sessions will expire."
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Reset password
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
