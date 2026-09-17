import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Alert,
  Button,
  Checkbox,
  Chip,
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
  Tooltip,
} from "@mui/material";
import { Controller, useForm, type Control } from "react-hook-form";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorAlert, Loading } from "../components/common/ApiFeedback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ActionsMenu from "../components/common/ActionsMenu";
import {
  BANDS,
  bandLabel,
  labelFor,
  PMF_MODES,
  WIFI_SECURITY,
  WPA_VERSIONS,
  ENCRYPTIONS,
} from "../constants/omadaEnums";
import type { Schedule, Ssid, WifiForm } from "../types/omada";
import {
  assignSchedule,
  changePassword,
  createSsid,
  deleteSsid,
  listSsids,
} from "../services/ssidService";
import { listSchedules } from "../services/scheduleService";
import { listPortals } from "../services/portalService";
const defaults: WifiForm = {
  name: "",
  password: "",
  bands: [1, 2],
  guestNetEnable: true,
  broadcast: true,
  security: 3,
  versionPsk: 2,
  encryptionPsk: 3,
  pmfMode: 3,
  enable11r: true,
  prohibitWifiShare: true,
  vlanEnable: false,
};
export default function WifiPage() {
  const [rows, setRows] = useState<Ssid[]>([]),
    [schedules, setSchedules] = useState<Schedule[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [createOpen, setCreateOpen] = useState(false),
    [passwordFor, setPasswordFor] = useState<Ssid | null>(null),
    [scheduleFor, setScheduleFor] = useState<Ssid | null>(null),
    [deleting, setDeleting] = useState<Ssid | null>(null),
    [view, setView] = useState<Ssid | null>(null),
    [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [a, b, portals] = await Promise.all([
        listSsids(),
        listSchedules(),
        listPortals(),
      ]);
      setRows(
        a.map((ssid) => ({
          ...ssid,
          portalName:
            portals
              .filter((portal) =>
                portal.ssidList?.includes(ssid.ssidId || ssid.id!),
              )
              .map((portal) => portal.name)
              .join(", ") || undefined,
        })),
      );
      setSchedules(b);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>, successMessage: string) => {
    setLoading(true);
    setError(undefined);
    setSuccess("");
    try {
      await fn();
      await load();
      setSuccess(successMessage);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };
  return (
    <>
      <PageHeader
        title="WiFi Management"
        description="Create and operate wireless networks at this location."
        addLabel="Add New WiFi Network"
        onAdd={() => setCreateOpen(true)}
        onRefresh={load}
      />
      <ApiErrorAlert error={error} />
      <Loading show={loading} />
      <Paper className="table-wrap">
        <Table>
          <TableHead>
            <TableRow>
              {[
                "WiFi Name",
                "Bands",
                "Security",
                "Guest Network",
                "Schedule",
                "Portal",
                "Actions",
              ].map((x) => (
                <TableCell key={x}>{x}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow hover key={r.ssidId || r.id}>
                <TableCell>
                  <b>{r.name}</b>
                </TableCell>
                <TableCell>{bandLabel(r.band)}</TableCell>
                <TableCell>{labelFor(WIFI_SECURITY, r.security)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={r.guestNetEnable ? "success" : "default"}
                    label={r.guestNetEnable ? "Enabled" : "Disabled"}
                  />
                </TableCell>
                <TableCell>
                  {r.wlanScheduleEnable ? "Assigned" : "Always available"}
                </TableCell>
                <TableCell>{r.portalName || "—"}</TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${r.name}`}
                    items={[
                      { label: "View details", onClick: () => setView(r) },
                      {
                        label: "Change password",
                        onClick: () => setPasswordFor(r),
                      },
                      {
                        label: "Manage schedule",
                        onClick: () => setScheduleFor(r),
                      },
                      {
                        label: "Delete network",
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
                  colSpan={7}
                  align="center"
                  sx={{ py: 6, color: "text.secondary" }}
                >
                  No WiFi networks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <CreateWifi
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(f) =>
          act(async () => {
            await createSsid(f);
            setCreateOpen(false);
          }, "WiFi network created successfully.")
        }
      />
      <PasswordDialog
        ssid={passwordFor}
        onClose={() => setPasswordFor(null)}
        onSave={(p) =>
          act(async () => {
            await changePassword(passwordFor!, p);
            setPasswordFor(null);
          }, "WiFi password updated successfully.")
        }
      />
      <ScheduleDialog
        ssid={scheduleFor}
        schedules={schedules}
        onClose={() => setScheduleFor(null)}
        onSave={(enabled, s, a) =>
          act(async () => {
            await assignSchedule(
              scheduleFor!.ssidId || scheduleFor!.id!,
              enabled,
              s,
              a,
            );
            setScheduleFor(null);
          }, "WiFi schedule updated successfully.")
        }
      />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ""}”?`}
        body="This action cannot be undone."
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          act(async () => {
            await deleteSsid(deleting!.ssidId || deleting!.id!);
            setDeleting(null);
          }, "WiFi network deleted successfully.")
        }
      />
      <Dialog
        open={!!view}
        onClose={() => setView(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>WiFi network details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="SSID Name"
              value={view?.name || ""}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Bands"
              value={view ? bandLabel(view.band) : ""}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Security"
              value={view ? labelFor(WIFI_SECURITY, view.security) : ""}
              slotProps={{ input: { readOnly: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setView(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={!!success}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={() => setSuccess("")}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSuccess("")}
        >
          {success}
        </Alert>
      </Snackbar>
    </>
  );
}
function CreateWifi({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: WifiForm) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<WifiForm>({ defaultValues: defaults });
  const security = watch("security"),
    bands = watch("bands"),
    vlan = watch("vlanEnable"),
    six = bands.includes(4);
  const submit = (v: WifiForm) => {
    if (six && v.versionPsk !== 4) return;
    onSave(v);
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(submit)}>
        <DialogTitle>Create WiFi Network</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} mt={1}>
            <TextField
              label="SSID Name"
              {...register("name", {
                required: "SSID name is required",
                validate: (v) =>
                  new TextEncoder().encode(v).length <= 32 ||
                  "Maximum 32 UTF-8 bytes",
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <Controller
              name="bands"
              control={control}
              rules={{
                validate: (v) => v.length > 0 || "Select at least one band",
              }}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error}>
                  <InputLabel>Bands</InputLabel>
                  <Select
                    multiple
                    label="Bands"
                    value={field.value}
                    onChange={field.onChange}
                    renderValue={(v) =>
                      bandLabel((v as number[]).reduce((a, b) => a | b, 0))
                    }
                  >
                    {BANDS.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        <Checkbox checked={field.value.includes(x.value)} />
                        <ListItemText primary={x.label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="security"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Security</InputLabel>
                  <Select {...field} label="Security">
                    {WIFI_SECURITY.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        {x.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {security === 3 && (
              <>
                <TextField
                  type="password"
                  label="Password"
                  {...register("password", {
                    required: true,
                    minLength: {
                      value: 8,
                      message: "Use 8–63 printable ASCII characters",
                    },
                    maxLength: {
                      value: 63,
                      message: "Use 8–63 printable ASCII characters",
                    },
                    pattern: {
                      value: /^[\x20-\x7E]+$/,
                      message: "Use printable ASCII characters only",
                    },
                  })}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
                <Controller
                  name="versionPsk"
                  control={control}
                  rules={{
                    validate: (v) =>
                      !six || v === 4 || "6 GHz requires WPA2/WPA3",
                  }}
                  render={({ field, fieldState }) => (
                    <FormControl error={!!fieldState.error}>
                      <InputLabel>WPA version</InputLabel>
                      <Select {...field} label="WPA version">
                        {WPA_VERSIONS.map((x) => (
                          <MenuItem key={x.value} value={x.value}>
                            {x.label}
                          </MenuItem>
                        ))}
                      </Select>
                      {fieldState.error && (
                        <Box
                          sx={{ color: "error.main", fontSize: 12, mt: 0.5 }}
                        >
                          {fieldState.error.message}
                        </Box>
                      )}
                    </FormControl>
                  )}
                />
                <Controller
                  name="encryptionPsk"
                  control={control}
                  render={({ field }) => (
                    <FormControl>
                      <InputLabel>Encryption</InputLabel>
                      <Select {...field} label="Encryption">
                        {ENCRYPTIONS.map((x) => (
                          <MenuItem key={x.value} value={x.value}>
                            {x.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </>
            )}
            <Controller
              name="pmfMode"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Protected management frames</InputLabel>
                  <Select {...field} label="Protected management frames">
                    {PMF_MODES.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        {x.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Toggle
                control={control}
                name="guestNetEnable"
                label="Guest network"
              />
              <Toggle
                control={control}
                name="broadcast"
                label="Broadcast SSID"
              />
              <Toggle control={control} name="enable11r" label="802.11r" />
              <Toggle
                control={control}
                name="prohibitWifiShare"
                label="Prohibit WiFi sharing"
              />
              <Toggle
                control={control}
                name="vlanEnable"
                label="VLAN enabled"
              />
            </Stack>
            {vlan && (
              <TextField
                type="number"
                label="VLAN ID"
                {...register("vlanId", {
                  valueAsNumber: true,
                  required: true,
                  min: 1,
                  max: 4094,
                })}
                error={!!errors.vlanId}
                helperText={
                  errors.vlanId ? "Enter a VLAN ID from 1 to 4094" : ""
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Create network
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
function Toggle({
  control,
  name,
  label,
}: {
  control: Control<WifiForm>;
  name: keyof WifiForm;
  label: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          label={label}
          control={
            <Switch
              checked={!!field.value}
              onChange={(_, v) => field.onChange(v)}
            />
          }
        />
      )}
    />
  );
} // eslint-disable-line @typescript-eslint/no-explicit-any
function PasswordDialog({
  ssid,
  onClose,
  onSave,
}: {
  ssid: Ssid | null;
  onClose: () => void;
  onSave: (p: string) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<{ password: string; confirm: string }>();
  return (
    <Dialog open={!!ssid} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit((v) => onSave(v.password))}>
        <DialogTitle>Change WiFi Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="SSID Name"
              value={ssid?.name || ""}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              type="password"
              label="New Password"
              {...register("password", {
                required: true,
                minLength: 8,
                maxLength: 63,
                pattern: /^[\x20-\x7E]+$/,
              })}
              error={!!errors.password}
              helperText={
                errors.password ? "Use 8–63 printable ASCII characters" : ""
              }
            />
            <TextField
              type="password"
              label="Confirm Password"
              {...register("confirm", {
                required: true,
                validate: (v) =>
                  v === watch("password") || "Passwords do not match",
              })}
              error={!!errors.confirm}
              helperText={errors.confirm?.message}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Update password
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
function ScheduleDialog({
  ssid,
  schedules,
  onClose,
  onSave,
}: {
  ssid: Ssid | null;
  schedules: Schedule[];
  onClose: () => void;
  onSave: (e: boolean, s: Schedule | null, a: number) => void;
}) {
  const [enabled, setEnabled] = useState(true),
    [id, setId] = useState(""),
    [action, setAction] = useState(1);
  const selected = schedules.find((x) => x.profileId === id) || null;
  return (
    <Dialog open={!!ssid} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Manage WiFi Schedule</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <FormControlLabel
            label="Enable schedule"
            control={
              <Switch checked={enabled} onChange={(_, v) => setEnabled(v)} />
            }
          />
          <FormControl disabled={!enabled}>
            <InputLabel>Schedule</InputLabel>
            <Select
              value={id}
              onChange={(e) => setId(e.target.value)}
              label="Schedule"
            >
              {schedules.map((x) => (
                <MenuItem key={x.profileId} value={x.profileId}>
                  {x.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl disabled={!enabled}>
            <InputLabel>Action</InputLabel>
            <Select
              value={action}
              onChange={(e) => setAction(Number(e.target.value))}
              label="Action"
            >
              <MenuItem value={1}>WiFi ON during selected period</MenuItem>
              <MenuItem value={0}>WiFi OFF during selected period</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Tooltip title={enabled && !selected ? "Select a schedule" : ""}>
          <span>
            <Button
              variant="contained"
              disabled={enabled && !selected}
              onClick={() => onSave(enabled, selected, action)}
            >
              Save
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
