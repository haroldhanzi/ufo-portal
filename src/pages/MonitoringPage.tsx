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
  Typography,
} from "@mui/material";
import { useBackendAuth } from "../components/common/authContext";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorDialog, Loading } from "../components/common/ApiFeedback";
import ActionsMenu from "../components/common/ActionsMenu";
import { getSiteId } from "../services/omadaClient";
import { listSites, type OmadaSite } from "../services/siteService";
import {
  addDeviceRule,
  createDevice,
  deviceHistory,
  deviceNotifications,
  deviceRules,
  disableDeviceRule,
  listDevices,
  rebootDevice,
  updateDevice,
  type AlertRule,
  type AlertRuleInput,
  type DeviceInput,
  type MonitoredDevice,
  type Notification,
  type StatusChange,
} from "../services/monitoringService";
const readable = (value: string) =>
  ({
    EMAIL: "Email",
    SMS: "SMS",
    BOTH: "Email and SMS",
    STATE: "Current status",
    STATE_CHANGE: "Status change",
    PERIOD_IN_STATE: "Time in status",
  })[value] ||
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
const deviceNumber = (device: MonitoredDevice) =>
  !device.deviceNumber ||
  /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i.test(device.deviceNumber)
    ? String(device.id)
    : device.deviceNumber;
const deviceName = (device: MonitoredDevice) =>
  !device.name || /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i.test(device.name)
    ? "Unnamed device"
    : device.name;
const date = (value?: string) =>
  value ? new Date(value).toLocaleString() : "—";
export default function MonitoringPage() {
  const { user } = useBackendAuth();
  return (
    <HardwareMonitoring canEdit superAdmin={user.role === "SUPER_ADMIN"} />
  );
}
function HardwareMonitoring({
  canEdit,
  superAdmin,
}: {
  canEdit: boolean;
  superAdmin: boolean;
}) {
  const { user } = useBackendAuth();
  const siteName = (siteId: string) =>
    sites.find((s) => s.id === siteId)?.name ||
    (user.siteId === siteId ? user.siteName : null);
  const [site, setSite] = useState(superAdmin ? "" : getSiteId()),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<MonitoredDevice[]>([]),
    [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<MonitoredDevice | "new">(),
    [detail, setDetail] = useState<MonitoredDevice>(),
    [reboot, setReboot] = useState<MonitoredDevice>();
  const [sites, setSites] = useState<OmadaSite[]>([]),
    [sitesError, setSitesError] = useState("");
  useEffect(() => {
    if (!superAdmin) return;
    let mounted = true;
    listSites()
      .then((data) => {
        if (mounted) setSites(data);
      })
      .catch((err) => {
        if (mounted) setSitesError((err as Error).message);
      });
    return () => {
      mounted = false;
    };
  }, [superAdmin]);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await listDevices(site, page);
      setRows(data.content);
      setTotal(data.page.totalElements);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [site, page]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  const act = async (
    fn: () => Promise<unknown>,
    message = "Changes saved.",
  ) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setEditing(undefined);
      setReboot(undefined);
      setSuccess(message);
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
        title="Hardware Monitoring"
        description="Monitor device states, alerts, and escalations."
        addLabel={canEdit ? "Add device" : undefined}
        onAdd={canEdit ? () => setEditing("new") : undefined}
        onRefresh={load}
      />
      {superAdmin && (
        <TextField
          select
          label="Site"
          value={site}
          onChange={(e) => {
            setSite(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ mb: 2, width: 340 }}
        >
          <MenuItem value="">All sites</MenuItem>
          {sites.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      <ApiErrorDialog
        error={sitesError}
        onClose={() => setSitesError("")}
        title="Unable to load site filters"
      />
      <ApiErrorDialog error={error} onClose={() => setError("")} />
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}
      <Loading show={busy} />
      <Paper
        className="table-wrap"
        role="region"
        aria-label="Hardware table"
        tabIndex={0}
      >
        <Table>
          <TableHead>
            {superAdmin ? (
              <>
                <TableRow>
                  {[
                    "Device #",
                    "Device Name",
                    "Device Location",
                    "Device Status",
                  ].map((h) => (
                    <TableCell key={h} rowSpan={2} scope="col">
                      {h}
                    </TableCell>
                  ))}
                  <TableCell colSpan={3} align="center" scope="colgroup">
                    Disconnection Alert Resource
                  </TableCell>
                  <TableCell colSpan={3} align="center" scope="colgroup">
                    Disconnection Alert Escalation
                  </TableCell>
                  <TableCell rowSpan={2} scope="col">
                    Escalation time in Hours
                  </TableCell>
                  <TableCell rowSpan={2} scope="col">
                    Actions
                  </TableCell>
                </TableRow>
                <TableRow>
                  {["Resource", "Escalation"].flatMap((group) =>
                    ["Name", "Mobile", "Email"].map((h) => (
                      <TableCell key={group + h} scope="col">
                        {h}
                      </TableCell>
                    )),
                  )}
                </TableRow>
              </>
            ) : (
              <TableRow>
                {[
                  "MAC Address",
                  "Device Number",
                  "Device Name",
                  "Device Location",
                  "Previous Device State",
                  "Current Device State",
                  "Last Status Change (DateTime)",
                  "Actions",
                ].map((h) => (
                  <TableCell key={h} scope="col">
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                {!superAdmin && <TableCell>{d.mac}</TableCell>}
                <TableCell>{deviceNumber(d)}</TableCell>
                <TableCell>{deviceName(d)}</TableCell>
                <TableCell>
                  {d.location?.trim() ||
                    siteName(d.siteId) ||
                    "Location unavailable"}
                  {d.location?.trim() &&
                    siteName(d.siteId) &&
                    d.location.trim() !== siteName(d.siteId) && (
                      <Typography variant="body2" color="text.secondary">
                        {siteName(d.siteId)}
                      </Typography>
                    )}
                </TableCell>
                {!superAdmin && (
                  <TableCell>{readable(d.previousState)}</TableCell>
                )}
                <TableCell>
                  <Chip
                    size="small"
                    color={
                      d.currentState === "CONNECTED"
                        ? "success"
                        : d.currentState === "DISCONNECTED"
                          ? "error"
                          : "default"
                    }
                    label={readable(d.currentState)}
                  />
                </TableCell>
                {superAdmin ? (
                  <>
                    {[
                      d.alertRecipients || [],
                      d.escalationRecipients || [],
                    ].flatMap((contacts, group) =>
                      (["name", "mobile", "email"] as const).map((field) => (
                        <TableCell key={group + field}>
                          {contacts.length
                            ? contacts.map((contact, i) => (
                                <div key={i}>
                                  {contact[field] || "Not provided"}
                                </div>
                              ))
                            : "Not configured"}
                        </TableCell>
                      )),
                    )}
                    <TableCell>
                      {d.escalationHours?.length
                        ? d.escalationHours
                            .map((h) => Number(h.toFixed(4)))
                            .join(", ")
                        : "Not configured"}
                    </TableCell>
                  </>
                ) : (
                  <TableCell>{date(d.lastStatusChange)}</TableCell>
                )}
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${d.name}`}
                    items={[
                      {
                        label: "Alerts & history",
                        disabled: busy,
                        onClick: () => setDetail(d),
                      },
                      ...(canEdit
                        ? [
                            {
                              label: "Edit",
                              disabled: busy,
                              onClick: () => setEditing(d),
                            },
                            {
                              label: "Reboot",
                              disabled: busy || d.currentState !== "CONNECTED",
                              onClick: () => setReboot(d),
                            },
                          ]
                        : []),
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && !busy && (
              <TableRow>
                <TableCell colSpan={superAdmin ? 12 : 8} align="center">
                  No monitored devices at this site.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          page={page}
          rowsPerPage={25}
          rowsPerPageOptions={[25]}
          count={total}
          onPageChange={(_, p) => setPage(p)}
        />
      </Paper>
      {editing && (
        <DeviceDialog
          device={editing}
          site={site}
          sites={sites}
          superAdmin={superAdmin}
          busy={busy}
          onClose={() => setEditing(undefined)}
          onSave={(input) =>
            act(() =>
              editing === "new"
                ? createDevice(input)
                : updateDevice(editing.id, input),
            )
          }
        />
      )}
      {detail && (
        <DeviceDetails
          device={detail}
          canEdit={canEdit}
          onClose={() => {
            setDetail(undefined);
            void load();
          }}
        />
      )}
      <Dialog
        open={!!reboot}
        onClose={busy ? undefined : () => setReboot(undefined)}
      >
        <DialogTitle>Reboot {reboot?.name}?</DialogTitle>
        <DialogContent>
          Connected clients may temporarily lose access.
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setReboot(undefined)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              reboot &&
              void act(
                () => rebootDevice(reboot.id),
                "Reboot request accepted.",
              )
            }
          >
            Reboot
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
function DeviceDialog({
  device,
  site,
  sites,
  superAdmin,
  busy,
  onClose,
  onSave,
}: {
  device: MonitoredDevice | "new";
  site: string;
  sites: OmadaSite[];
  superAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (input: DeviceInput) => void;
}) {
  const [input, setInput] = useState<DeviceInput>(
    device === "new"
      ? { siteId: site, mac: "", deviceNumber: "", name: "", location: "" }
      : device,
  );
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(input);
        }}
      >
        <DialogTitle>
          {device === "new" ? "Add monitored device" : "Edit device"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {device === "new" && superAdmin && (
              <TextField
                select
                label="Site"
                value={input.siteId}
                required
                disabled={busy}
                onChange={(e) => setInput({ ...input, siteId: e.target.value })}
              >
                {sites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {(
              [
                ["siteId", "Site ID", 100],
                ["mac", "MAC address", 17],
                ["deviceNumber", "Device number", 100],
                ["name", "Device name", 200],
                ["location", "Device location", 300],
              ] as const
            )
              .filter(([key]) => key !== "siteId")
              .map(([key, label, maxLength]) => (
                <TextField
                  key={key}
                  label={label}
                  value={input[key]}
                  onChange={(e) =>
                    setInput({ ...input, [key]: e.target.value })
                  }
                  required
                  disabled={
                    busy ||
                    (device !== "new" && (key === "siteId" || key === "mac"))
                  }
                  slotProps={{
                    htmlInput: {
                      maxLength,
                      ...(key === "mac"
                        ? { pattern: "[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}" }
                        : {}),
                    },
                  }}
                />
              ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
function DeviceDetails({
  device,
  canEdit,
  onClose,
}: {
  device: MonitoredDevice;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<AlertRule[]>([]),
    [history, setHistory] = useState<StatusChange[]>([]),
    [notices, setNotices] = useState<Notification[]>([]);
  const [historyPage, setHistoryPage] = useState(0),
    [noticePage, setNoticePage] = useState(0),
    [historyTotal, setHistoryTotal] = useState(0),
    [noticeTotal, setNoticeTotal] = useState(0);
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [r, h, n] = await Promise.all([
        deviceRules(device.id),
        deviceHistory(device.id, historyPage),
        deviceNotifications(device.id, noticePage),
      ]);
      setRules(r);
      setHistory(h.content);
      setNotices(n.content);
      setHistoryTotal(h.page.totalElements);
      setNoticeTotal(n.page.totalElements);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [device.id, historyPage, noticePage]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setAdding(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>{device.name}: alerts & history</DialogTitle>
      <ApiErrorDialog error={error} onClose={() => setError("")} />
      <DialogContent>
        <Loading show={busy} />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6">Notification & escalation rules</Typography>
          {canEdit && (
            <Button disabled={busy} onClick={() => setAdding(true)}>
              Add rule
            </Button>
          )}
        </Stack>
        <div
          className="table-wrap"
          role="region"
          aria-label="Alert rules table"
          tabIndex={0}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  "Kind",
                  "Channel",
                  "Trigger",
                  "Delay",
                  "Max count",
                  "Window",
                  "Recipients",
                  "Actions",
                ].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{readable(r.kind)}</TableCell>
                  <TableCell>{readable(r.method)}</TableCell>
                  <TableCell>
                    {readable(r.triggerType)} · {readable(r.targetState)}
                  </TableCell>
                  <TableCell>{r.minimumSeconds / 3600} hours</TableCell>
                  <TableCell>{r.maximumCount || "Disabled"}</TableCell>
                  <TableCell>
                    {r.startTime}–{r.endTime} ({r.zoneId})
                  </TableCell>
                  <TableCell>
                    {(JSON.parse(r.recipientsJson) as { name: string }[])
                      .map((c) => c.name)
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <ActionsMenu
                        label={`Actions for ${r.kind.toLowerCase()} rule ${r.id}`}
                        items={[
                          {
                            label: "Disable",
                            color: "error",
                            disabled: busy || r.maximumCount === 0,
                            onClick: () =>
                              void act(() =>
                                disableDeviceRule(device.id, r.id),
                              ),
                          },
                        ]}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rules.length && (
                <TableRow>
                  <TableCell colSpan={8}>No rules configured.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Typography variant="h6" mt={3}>
          Notifications & escalations
        </Typography>
        <div
          className="table-wrap"
          role="region"
          aria-label="Notifications and escalations table"
          tabIndex={0}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  "Time",
                  "Kind",
                  "Channel",
                  "Message",
                  "Delivery",
                  "Attempts",
                ].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>{date(n.createdAt)}</TableCell>
                  <TableCell>{readable(n.kind)}</TableCell>
                  <TableCell>{readable(n.method)}</TableCell>
                  <TableCell>{n.message}</TableCell>
                  <TableCell>{readable(n.deliveryState)}</TableCell>
                  <TableCell>{n.attemptCount}</TableCell>
                </TableRow>
              ))}
              {!notices.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    No notifications or escalations.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          component="div"
          count={noticeTotal}
          page={noticePage}
          rowsPerPage={25}
          rowsPerPageOptions={[25]}
          onPageChange={(_, p) => setNoticePage(p)}
        />
        <Typography variant="h6" mt={3}>
          State history
        </Typography>
        <div
          className="table-wrap"
          role="region"
          aria-label="State history table"
          tabIndex={0}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Previous state</TableCell>
                <TableCell>Current state</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{date(h.changedAt)}</TableCell>
                  <TableCell>{readable(h.previousState)}</TableCell>
                  <TableCell>{readable(h.currentState)}</TableCell>
                </TableRow>
              ))}
              {!history.length && (
                <TableRow>
                  <TableCell colSpan={3}>No state changes recorded.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          component="div"
          count={historyTotal}
          page={historyPage}
          rowsPerPage={25}
          rowsPerPageOptions={[25]}
          onPageChange={(_, p) => setHistoryPage(p)}
        />
        {adding && (
          <RuleDialog
            busy={busy}
            onClose={() => setAdding(false)}
            onSave={(rule) => act(() => addDeviceRule(device.id, rule))}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={load}>
          Refresh
        </Button>
        <Button disabled={busy} onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
function RuleDialog({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (input: AlertRuleInput) => void;
}) {
  const [rule, setRule] = useState<AlertRuleInput>({
    kind: "NOTIFICATION",
    method: "EMAIL",
    triggerType: "PERIOD_IN_STATE",
    targetState: "DISCONNECTED",
    minimumSeconds: 0,
    repeatSeconds: 3600,
    maximumCount: 3,
    startTime: "00:00",
    endTime: "00:00",
    zoneId: "Africa/Harare",
    overrideMac: null,
    recipients: [{ name: "", email: null, mobile: null }],
  });
  const field = (key: keyof AlertRuleInput, value: unknown) =>
    setRule({ ...rule, [key]: value });
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(rule);
        }}
      >
        <DialogTitle>Add alert rule</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {(
              [
                ["kind", "Rule type", ["NOTIFICATION", "ESCALATION"]],
                ["method", "Delivery method", ["EMAIL", "SMS", "BOTH"]],
                [
                  "triggerType",
                  "Trigger",
                  ["STATE", "STATE_CHANGE", "PERIOD_IN_STATE"],
                ],
                ["targetState", "Target state", ["DISCONNECTED", "CONNECTED"]],
              ] as const
            ).map(([key, label, values]) => (
              <TextField
                select
                key={key}
                label={label}
                value={rule[key]}
                disabled={busy}
                onChange={(e) => field(key, e.target.value)}
              >
                {values.map((v) => (
                  <MenuItem key={v} value={v}>
                    {readable(v)}
                  </MenuItem>
                ))}
              </TextField>
            ))}
            <TextField
              label="Delay in hours"
              type="number"
              value={rule.minimumSeconds / 3600}
              disabled={busy}
              required
              onChange={(e) =>
                field(
                  "minimumSeconds",
                  Math.round(Number(e.target.value) * 3600),
                )
              }
              slotProps={{ htmlInput: { min: 0, step: "any" } }}
            />
            <TextField
              label="Repeat interval in minutes"
              type="number"
              value={rule.repeatSeconds / 60}
              required
              disabled={busy}
              onChange={(e) =>
                field("repeatSeconds", Math.round(Number(e.target.value) * 60))
              }
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label="Maximum notifications"
              type="number"
              value={rule.maximumCount}
              required
              disabled={busy}
              onChange={(e) => field("maximumCount", Number(e.target.value))}
              slotProps={{ htmlInput: { min: 0, max: 1000 } }}
              helperText="Zero disables the rule."
            />
            <Stack direction="row" spacing={2}>
              {(["startTime", "endTime"] as const).map((key) => (
                <TextField
                  key={key}
                  type="time"
                  label={key === "startTime" ? "From" : "To"}
                  value={rule[key]}
                  required
                  disabled={busy}
                  onChange={(e) => field(key, e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              ))}
            </Stack>
            <Typography variant="caption">
              Equal start and end times means all day.
            </Typography>
            <TextField
              label="Time zone"
              value={rule.zoneId}
              required
              disabled={busy}
              onChange={(e) => field("zoneId", e.target.value)}
            />
            <TextField
              label="Upstream device MAC (optional)"
              value={rule.overrideMac || ""}
              disabled={busy}
              onChange={(e) => field("overrideMac", e.target.value || null)}
              helperText="Suppress alerts while this registered device is unavailable."
              slotProps={{
                htmlInput: { pattern: "[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}" },
              }}
            />
            <Typography variant="subtitle2">Recipients</Typography>
            {rule.recipients.map((r, i) => (
              <Stack key={i} spacing={1}>
                <TextField
                  label="Name"
                  value={r.name}
                  required
                  disabled={busy}
                  onChange={(e) =>
                    field(
                      "recipients",
                      rule.recipients.map((c, j) =>
                        i === j ? { ...c, name: e.target.value } : c,
                      ),
                    )
                  }
                />
                {rule.method !== "SMS" && (
                  <TextField
                    label="Email"
                    type="email"
                    value={r.email || ""}
                    required
                    disabled={busy}
                    onChange={(e) =>
                      field(
                        "recipients",
                        rule.recipients.map((c, j) =>
                          i === j ? { ...c, email: e.target.value || null } : c,
                        ),
                      )
                    }
                  />
                )}
                {rule.method !== "EMAIL" && (
                  <TextField
                    label="Mobile"
                    value={r.mobile || ""}
                    required
                    disabled={busy}
                    onChange={(e) =>
                      field(
                        "recipients",
                        rule.recipients.map((c, j) =>
                          i === j
                            ? { ...c, mobile: e.target.value || null }
                            : c,
                        ),
                      )
                    }
                    slotProps={{ htmlInput: { pattern: "[+]?[0-9]{7,15}" } }}
                  />
                )}
                {rule.recipients.length > 1 && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      field(
                        "recipients",
                        rule.recipients.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove recipient
                  </Button>
                )}
              </Stack>
            ))}
            <Button
              disabled={busy || rule.recipients.length >= 100}
              onClick={() =>
                field("recipients", [
                  ...rule.recipients,
                  { name: "", email: null, mobile: null },
                ])
              }
            >
              Add recipient
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            Save rule
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
