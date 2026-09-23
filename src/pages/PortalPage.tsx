import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorSnackbar, Loading } from "../components/common/ApiFeedback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ActionsMenu from "../components/common/ActionsMenu";
import { HOTSPOT_AUTH, PORTAL_AUTH } from "../constants/omadaEnums";
import type { Portal, PortalForm, Ssid } from "../types/omada";
import {
  createPortal,
  deletePortal,
  listPortals,
  updatePortal,
  updatePortalAppearance,
} from "../services/portalService";
import { listSsids } from "../services/ssidService";
export default function PortalPage() {
  const [rows, setRows] = useState<Portal[]>([]),
    [ssids, setSsids] = useState<Ssid[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [open, setOpen] = useState(false),
    [associating, setAssociating] = useState<Portal | null>(null),
    [editingAppearance, setEditingAppearance] = useState<Portal | null>(null),
    [deleting, setDeleting] = useState<Portal | null>(null),
    [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [a, b] = await Promise.all([listPortals(), listSsids()]);
      setRows(a);
      setSsids(b);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(undefined);
    try {
      await fn();
      setOpen(false);
      setAssociating(null);
      setEditingAppearance(null);
      setDeleting(null);
      await load();
      setSuccess("Changes saved successfully.");
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };
  const names = (ids: string[]) =>
    ids
      .map((id) => ssids.find((s) => (s.ssidId || s.id) === id)?.name || id)
      .join(", ");
  return (
    <>
      <PageHeader
        title="Portal Management"
        description="Manage captive portals and their WiFi associations."
        addLabel="Create Portal"
        onAdd={() => setOpen(true)}
        onRefresh={load}
      />
      <ApiErrorSnackbar error={error} onClose={() => setError(undefined)} />
      <Loading show={loading} />
      <Paper className="table-wrap">
        <Table>
          <TableHead>
            <TableRow>
              {["Portal Name", "Associated WiFi Networks", "Actions"].map((x) => (
                <TableCell key={x}>{x}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id || r.portalId}>
                <TableCell>
                  <b>{r.name}</b>
                </TableCell>
                <TableCell>{names(r.ssidList) || "None"}</TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${r.name}`}
                    items={[
                      {
                        label: "Manage WiFi associations",
                        onClick: () => setAssociating(r),
                      },
                      {
                        label: "Edit portal",
                        onClick: () => setEditingAppearance(r),
                      },
                      {
                        label: "Delete portal",
                        color: "error",
                        onClick: () => setDeleting(r),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && !loading && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  align="center"
                  sx={{ py: 6, color: "text.secondary" }}
                >
                  No portals found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <PortalDialog
        open={open}
        ssids={ssids}
        onClose={() => setOpen(false)}
        onSave={(f) => act(() => createPortal(f))}
      />
      {associating && (
        <AssociationDialog
          portal={associating}
          ssids={ssids}
          onClose={() => setAssociating(null)}
          onSave={(ids) => act(() => updatePortal(associating, ids))}
        />
      )}
      {editingAppearance && (
        <AppearanceDialog
          portal={editingAppearance}
          onClose={() => setEditingAppearance(null)}
          onSave={(logoDisplay) =>
            act(() => updatePortalAppearance(editingAppearance, logoDisplay))
          }
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ""}”?`}
        body="This portal and its associations will be permanently removed."
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          act(() => deletePortal(deleting!.id || deleting!.portalId!))
        }
      />
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess("")}
        message={success}
      />
    </>
  );
}
function PortalDialog({
  open,
  ssids,
  onClose,
  onSave,
}: {
  open: boolean;
  ssids: Ssid[];
  onClose: () => void;
  onSave: (f: PortalForm) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PortalForm>({
    defaultValues: {
      name: "",
      enable: true,
      ssidList: [],
      authType: 11,
      hotspotType: 3,
      landingPage: 1,
      httpsRedirectEnable: true,
    },
  });
  const auth = watch("authType");
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSave)}>
        <DialogTitle>Create Voucher Portal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Portal Name"
              {...register("name", { required: "Portal name is required" })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <Controller
              name="enable"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  label="Enabled"
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, v) => field.onChange(v)}
                    />
                  }
                />
              )}
            />
            <Controller
              name="ssidList"
              control={control}
              rules={{
                validate: (v) =>
                  v.length > 0 || "Select at least one WiFi network",
              }}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Associated WiFi Networks</InputLabel>
                  <Select
                    {...field}
                    multiple
                    label="Associated WiFi Networks"
                    renderValue={(v) =>
                      (v as string[])
                        .map(
                          (id) =>
                            ssids.find((s) => (s.ssidId || s.id) === id)?.name,
                        )
                        .join(", ")
                    }
                  >
                    {ssids.map((s) => {
                      const id = s.ssidId || s.id!;
                      return (
                        <MenuItem key={id} value={id}>
                          <Checkbox checked={field.value.includes(id)} />
                          <ListItemText primary={s.name} />
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="authType"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Authentication Type</InputLabel>
                  <Select {...field} label="Authentication Type">
                    {PORTAL_AUTH.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        {x.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {auth === 11 && (
              <Controller
                name="hotspotType"
                control={control}
                render={({ field }) => (
                  <FormControl>
                    <InputLabel>Hotspot Type</InputLabel>
                    <Select {...field} label="Hotspot Type">
                      {HOTSPOT_AUTH.map((x) => (
                        <MenuItem key={x.value} value={x.value}>
                          {x.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            )}
            <Controller
              name="landingPage"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Landing Page</InputLabel>
                  <Select {...field} label="Landing Page">
                    <MenuItem value={1}>Promotion page</MenuItem>
                    <MenuItem value={0}>Original URL</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="httpsRedirectEnable"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  label="HTTPS redirect"
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, v) => field.onChange(v)}
                    />
                  }
                />
              )}
            />
            <TextField
              label="Portal Appearance"
              value="UFO default · English"
              slotProps={{ input: { readOnly: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" type="submit">
            Create portal
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
function AssociationDialog({
  portal,
  ssids,
  onClose,
  onSave,
}: {
  portal: Portal;
  ssids: Ssid[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>(portal.ssidList || []);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit WiFi Associations</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>Associated WiFi Networks</InputLabel>
          <Select
            multiple
            value={ids}
            onChange={(e) => setIds(e.target.value as string[])}
            label="Associated WiFi Networks"
            renderValue={(v) =>
              (v as string[])
                .map((id) => ssids.find((s) => (s.ssidId || s.id) === id)?.name)
                .join(", ")
            }
          >
            {ssids.map((s) => {
              const id = s.ssidId || s.id!;
              return (
                <MenuItem key={id} value={id}>
                  <Checkbox checked={ids.includes(id)} />
                  <ListItemText primary={s.name} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(ids)}>
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AppearanceDialog({
  portal,
  onClose,
  onSave,
}: {
  portal: Portal;
  onClose: () => void;
  onSave: (logoDisplay: boolean) => void;
}) {
  const currentLogoDisplay = portal.portalCustomize?.logoDisplay !== false;
  const [logo, setLogo] = useState(currentLogoDisplay ? "default" : "none");
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Portal Appearance</DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          <FormControl>
            <InputLabel>Background</InputLabel>
            <Select value="default" label="Background">
              <MenuItem value="default">Use default UFO background</MenuItem>
              <MenuItem value="upload" disabled>
                Upload a new background - API upload support required
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Logo</InputLabel>
            <Select
              value={logo}
              label="Logo"
              onChange={(event) => setLogo(event.target.value)}
            >
              <MenuItem value="none">Do not use a logo</MenuItem>
              <MenuItem value="default">Use default UFO logo</MenuItem>
              <MenuItem value="upload" disabled>
                Upload a new logo - API upload support required
              </MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(logo === "default")}>
          Save changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
