import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorSnackbar, Loading } from "../components/common/ApiFeedback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ActionsMenu from "../components/common/ActionsMenu";
import { validatePartnerName } from "../constants/nameValidation";
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
              {["Portal Name", "Associated WiFi Networks", "Actions"].map(
                (x) => (
                  <TableCell key={x}>{x}</TableCell>
                ),
              )}
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
          busy={loading}
          onClose={() => setEditingAppearance(null)}
          onSave={(logoDisplay, welcomeInformation, backgroundFile, logoFile) =>
            act(() =>
              updatePortalAppearance(
                editingAppearance,
                logoDisplay,
                welcomeInformation,
                backgroundFile,
                logoFile,
              ),
            )
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
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSave)}>
        <DialogTitle>Create Voucher Portal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Portal Name"
              {...register("name", {
                required: "Portal name is required",
                maxLength: {
                  value: 64,
                  message: "Portal name cannot exceed 64 characters",
                },
                validate: validatePartnerName,
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
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
  busy,
  onClose,
  onSave,
}: {
  portal: Portal;
  busy: boolean;
  onClose: () => void;
  onSave: (
    logoDisplay: boolean,
    welcomeInformation: string,
    backgroundFile?: File,
    logoFile?: File,
  ) => void;
}) {
  const currentLogoDisplay = portal.portalCustomize?.logoDisplay !== false;
  const [logo, setLogo] = useState(currentLogoDisplay ? "default" : "none");
  const [backgroundFile, setBackgroundFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [logoFile, setLogoFile] = useState<File>();
  const [logoPreview, setLogoPreview] = useState("");
  const [logoError, setLogoError] = useState("");
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  useEffect(() => {
    if (logoPreview) return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);
  const [welcomeInformation, setWelcomeInformation] = useState(
    typeof portal.portalCustomize?.welcomeInformation === "string"
      ? portal.portalCustomize.welcomeInformation
      : "",
  );
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Portal Appearance</DialogTitle>
      <DialogContent>
        <Stack spacing={3} mt={1}>
          <TextField
            label="Welcome text"
            value={welcomeInformation}
            onChange={(event) => setWelcomeInformation(event.target.value)}
            multiline
            minRows={3}
            disabled={busy}
            helperText="Shown on the portal login page. Leave blank to hide the welcome message."
          />
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Background size references: portrait 816 × 1024 px; landscape 1129
              × 973 px.
            </Typography>
            <Button component="label" variant="outlined" disabled={busy}>
              Choose background image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (!file.type.startsWith("image/") || file.size === 0) {
                    setFileError("Choose a non-empty image file.");
                    return;
                  }
                  setFileError("");
                  setBackgroundFile(file);
                  setDimensions("");
                  setPreview(URL.createObjectURL(file));
                }}
              />
            </Button>
            {fileError && <Alert severity="error">{fileError}</Alert>}
            {preview && (
              <>
                <img
                  src={preview}
                  alt="Selected portal background"
                  onLoad={(event) =>
                    setDimensions(
                      `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight} px`,
                    )
                  }
                  style={{
                    maxWidth: "100%",
                    maxHeight: 220,
                    objectFit: "contain",
                  }}
                />
                <Typography variant="body2">
                  {backgroundFile?.name} · {dimensions}
                </Typography>
                <Button
                  disabled={busy}
                  onClick={() => {
                    setBackgroundFile(undefined);
                    setPreview("");
                    setDimensions("");
                    setFileError("");
                  }}
                >
                  Clear selection
                </Button>
              </>
            )}
          </Stack>
          <FormControl>
            <InputLabel>Logo</InputLabel>
            <Select
              value={logo}
              label="Logo"
              disabled={busy}
              onChange={(event) => setLogo(event.target.value)}
            >
              <MenuItem value="none">Do not use a logo</MenuItem>
              <MenuItem value="default">Keep current logo</MenuItem>
              <MenuItem value="upload">Upload a new logo</MenuItem>
            </Select>
          </FormControl>
          {logo === "upload" && (
            <Stack spacing={1}>
              <Button component="label" variant="outlined" disabled={busy}>
                Choose logo image
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (!file.type.startsWith("image/") || file.size === 0) {
                      setLogoError("Choose a non-empty image file.");
                      return;
                    }
                    setLogoError("");
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                />
              </Button>
              {logoError && <Alert severity="error">{logoError}</Alert>}
              {logoPreview && (
                <>
                  <img
                    src={logoPreview}
                    alt="Selected portal logo"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 120,
                      objectFit: "contain",
                    }}
                  />
                  <Typography variant="body2">{logoFile?.name}</Typography>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setLogoFile(undefined);
                      setLogoPreview("");
                      setLogoError("");
                    }}
                  >
                    Clear selection
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={busy || (logo === "upload" && !logoFile)}
          onClick={() =>
            onSave(
              logo !== "none",
              welcomeInformation,
              backgroundFile,
              logo === "upload" ? logoFile : undefined,
            )
          }
        >
          {busy ? "Saving..." : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
