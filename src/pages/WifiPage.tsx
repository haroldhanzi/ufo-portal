import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
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
import { useForm } from "react-hook-form";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorAlert, Loading } from "../components/common/ApiFeedback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import ActionsMenu from "../components/common/ActionsMenu";
import type { Schedule, Ssid, WifiForm } from "../types/omada";
import { validatePartnerName } from "../constants/nameValidation";
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
              {["WiFi Name", "Password", "Schedule", "Portal", "Actions"].map(
                (x) => (
                  <TableCell key={x}>{x}</TableCell>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow hover key={r.ssidId || r.id}>
                <TableCell>
                  <b>{r.name}</b>
                </TableCell>
                <TableCell>
                  {r.security === 0 ? "No password" : "••••••••"}
                </TableCell>
                <TableCell>{scheduleLabel(r, schedules)}</TableCell>
                <TableCell>{r.portalName || "—"}</TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${r.name}`}
                    items={[
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
                  colSpan={5}
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
        key={`${scheduleFor?.ssidId || scheduleFor?.id || "closed"}-${scheduleFor?.wlanSchedule?.scheduleId || scheduleFor?.scheduleId || "none"}`}
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
function scheduleLabel(ssid: Ssid, schedules: Schedule[]) {
  const config = ssid.wlanSchedule;
  const enabled = config?.wlanScheduleEnable ?? ssid.wlanScheduleEnable;
  if (!enabled) return "Always available";
  const scheduleId = config?.scheduleId ?? ssid.scheduleId;
  return (
    config?.scheduleName ||
    ssid.scheduleName ||
    schedules.find((schedule) => schedule.profileId === scheduleId)?.name ||
    "Scheduled"
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
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WifiForm>({ defaultValues: defaults });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSave)}>
        <DialogTitle>Create WiFi Network</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} mt={1}>
            <TextField
              label="SSID Name"
              {...register("name", {
                required: "SSID name is required",
                validate: {
                  length: (v) =>
                    new TextEncoder().encode(v).length <= 32 ||
                    "Maximum 32 UTF-8 bytes",
                  reserved: validatePartnerName,
                },
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <TextField
              type="password"
              label="Password"
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Use 8-63 printable ASCII characters",
                },
                maxLength: {
                  value: 63,
                  message: "Use 8-63 printable ASCII characters",
                },
                pattern: {
                  value: /^[\x20-\x7E]+$/,
                  message: "Use printable ASCII characters only",
                },
              })}
              error={!!errors.password}
              helperText={errors.password?.message}
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
            Create network
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
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
  const config = ssid?.wlanSchedule;
  const [enabled, setEnabled] = useState(
      config?.wlanScheduleEnable ?? ssid?.wlanScheduleEnable ?? false,
    ),
    [id, setId] = useState(config?.scheduleId ?? ssid?.scheduleId ?? "");
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
          {enabled && (
            <Alert severity="info">
              WiFi will be on during the selected period.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Tooltip title={enabled && !selected ? "Select a schedule" : ""}>
          <span>
            <Button
              variant="contained"
              disabled={enabled && !selected}
              onClick={() => onSave(enabled, selected, 1)}
            >
              Save
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
}
