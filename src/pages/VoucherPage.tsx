import { useCallback, useEffect, useState } from "react";
import {
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
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
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
import { ApiErrorAlert, Loading } from "../components/common/ApiFeedback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import VoucherGroupDetailDialog from "../components/vouchers/VoucherGroupDetailDialog";
import ActionsMenu from "../components/common/ActionsMenu";
import {
  DURATION_TYPES,
  labelFor,
  TIMING_TYPES,
  TRAFFIC_FREQUENCIES,
  VALIDITY_TYPES,
  VOUCHER_LIMIT_TYPES,
} from "../constants/omadaEnums";
import type {
  Portal,
  Voucher,
  VoucherForm,
  VoucherGroup,
} from "../types/omada";
import {
  createVoucherGroup,
  deleteVoucher,
  findVoucher as findVoucherByCodeOrId,
  listVoucherGroups,
} from "../services/voucherService";
import { listPortals } from "../services/portalService";
export default function VoucherPage() {
  const [rows, setRows] = useState<VoucherGroup[]>([]),
    [portals, setPortals] = useState<Portal[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>(),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [voucherId, setVoucherId] = useState(""),
    [voucher, setVoucher] = useState<Voucher | null>(null),
    [voucherError, setVoucherError] = useState<unknown>(),
    [voucherLoading, setVoucherLoading] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [selectedGroup, setSelectedGroup] = useState<VoucherGroup | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [a, b] = await Promise.all([
        listVoucherGroups(1, 10, search),
        listPortals(),
      ]);
      setRows(a.data || []);
      setPortals(b);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (f: VoucherForm) => {
    setLoading(true);
    setError(undefined);
    try {
      await createVoucherGroup(f);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };
  const findVoucher = async () => {
    if (!voucherId.trim()) return;
    setVoucherLoading(true);
    setVoucherError(undefined);
    setVoucher(null);
    try {
      setVoucher(await findVoucherByCodeOrId(voucherId.trim()));
    } catch (e) {
      setVoucherError(e);
    } finally {
      setVoucherLoading(false);
    }
  };
  const removeVoucher = async () => {
    if (!voucher) return;
    setVoucherLoading(true);
    setVoucherError(undefined);
    try {
      await deleteVoucher(voucher.id);
      setVoucher(null);
      setVoucherId("");
      setDeleteOpen(false);
      await load();
    } catch (e) {
      setVoucherError(e);
      setDeleteOpen(false);
    } finally {
      setVoucherLoading(false);
    }
  };
  const portalName = (r: VoucherGroup) =>
    portals.find((p) => r.portals?.includes(p.id || p.portalId!))?.name || "—";
  return (
    <>
      <PageHeader
        title="Voucher Management"
        description="Issue and monitor WiFi access voucher groups."
        addLabel="Create Voucher Group"
        onAdd={() => setOpen(true)}
        onRefresh={load}
      />
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6">Find a voucher</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Look up an individual voucher using its printed code or Omada voucher
          ID.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            fullWidth
            size="small"
            label="Voucher code or ID"
            value={voucherId}
            onChange={(e) => setVoucherId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void findVoucher();
            }}
          />
          <Button
            variant="contained"
            disabled={!voucherId.trim() || voucherLoading}
            onClick={() => void findVoucher()}
          >
            {voucherLoading ? "Searching..." : "Search voucher"}
          </Button>
        </Stack>
        <ApiErrorAlert error={voucherError} />
        {voucher && (
          <VoucherResult
            voucher={voucher}
            onDelete={() => setDeleteOpen(true)}
          />
        )}
      </Paper>
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete voucher “${voucher?.code || voucher?.id || ""}”?`}
        body="This voucher will stop working immediately. This action cannot be undone."
        busy={voucherLoading}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void removeVoucher()}
      />
      <Stack direction="row" mb={2}>
        <TextField
          size="small"
          label="Search voucher groups"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 300 }}
        />
      </Stack>
      <ApiErrorAlert error={error} />
      <Loading show={loading} />
      <Paper className="table-wrap">
        <Table>
          <TableHead>
            <TableRow>
              {[
                "Group Name",
                "Created",
                "Creator",
                "Usage Type",
                "Duration",
                "Traffic Limit",
                "Portal",
                "Validity",
                "Used",
                "Unused",
                "Expired",
                "Actions",
              ].map((x) => (
                <TableCell key={x}>{x}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <b>{r.name}</b>
                </TableCell>
                <TableCell>
                  {r.createTime
                    ? new Date(r.createTime).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>{r.creator || "—"}</TableCell>
                <TableCell>
                  {labelFor(VOUCHER_LIMIT_TYPES, r.limitType)}
                </TableCell>
                <TableCell>{r.duration} min</TableCell>
                <TableCell>
                  {r.trafficLimitEnable ? `${r.trafficLimit} MB` : "Unlimited"}
                </TableCell>
                <TableCell>{portalName(r)}</TableCell>
                <TableCell>
                  {labelFor(VALIDITY_TYPES, r.validityType)}
                </TableCell>
                <TableCell>{r.used ?? 0}</TableCell>
                <TableCell>{r.unused ?? 0}</TableCell>
                <TableCell>{r.expired ?? 0}</TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${r.name}`}
                    items={[
                      {
                        label: "View vouchers",
                        onClick: () => setSelectedGroup(r),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && !loading && (
              <TableRow>
                <TableCell
                  colSpan={12}
                  align="center"
                  sx={{ py: 6, color: "text.secondary" }}
                >
                  No voucher groups found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <VoucherDialog
        open={open}
        portals={portals}
        onClose={() => setOpen(false)}
        onSave={save}
      />
      <VoucherGroupDetailDialog
        group={selectedGroup}
        onClose={() => setSelectedGroup(null)}
        onChanged={() => void load()}
      />
    </>
  );
}
function VoucherResult({
  voucher,
  onDelete,
}: {
  voucher: Voucher;
  onDelete: () => void;
}) {
  const date = (value: number) =>
    value ? new Date(value).toLocaleString() : "Not set";
  return (
    <Stack spacing={2} sx={{ mt: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6">{voucher.code || "Voucher"}</Typography>
        <Chip
          size="small"
          color={voucher.valid ? "success" : "error"}
          label={voucher.valid ? "Valid" : "Invalid"}
        />
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <ResultField label="Voucher ID" value={voucher.id} />
        <ResultField
          label="Usage limit"
          value={labelFor(VOUCHER_LIMIT_TYPES, voucher.limitType)}
        />
        <ResultField label="Used" value={String(voucher.used)} />
        <ResultField label="Duration" value={`${voucher.duration} minutes`} />
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <ResultField label="Effective" value={date(voucher.effectiveTime)} />
        <ResultField label="Expires" value={date(voucher.expirationTime)} />
        <ResultField
          label="Traffic"
          value={
            voucher.trafficLimitEnable
              ? `${voucher.trafficLimit} MB limit`
              : "Unlimited"
          }
        />
        <ResultField
          label="Portals"
          value={voucher.portalNames?.join(", ") || "None"}
        />
      </Stack>
      {(voucher.ssidNameList?.length > 0 || voucher.description) && (
        <Typography color="text.secondary">
          {voucher.ssidNameList?.length > 0 &&
            `WiFi: ${voucher.ssidNameList.join(", ")}`}
          {voucher.ssidNameList?.length > 0 && voucher.description && " · "}
          {voucher.description}
        </Typography>
      )}
      <div>
        <Button color="error" variant="outlined" onClick={onDelete}>
          Delete voucher
        </Button>
      </div>
    </Stack>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 150 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </div>
  );
}

function VoucherDialog({
  open,
  portals,
  onClose,
  onSave,
}: {
  open: boolean;
  portals: Portal[];
  onClose: () => void;
  onSave: (f: VoucherForm) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VoucherForm>({
    defaultValues: {
      name: "",
      amount: 10,
      codeLength: 8,
      codeForm: [0],
      limitType: 0,
      limitNum: 1,
      durationType: 0,
      duration: 1440,
      timingType: 0,
      trafficLimitEnable: true,
      trafficLimit: 1024,
      trafficLimitFrequency: 0,
      unitPrice: 1,
      currency: "USD",
      portalId: "",
      validityType: 0,
      description: "UFO Partner voucher group",
    },
  });
  const validity = watch("validityType"),
    traffic = watch("trafficLimitEnable"),
    limit = watch("limitType");
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit(onSave)}>
        <DialogTitle>Create Voucher Group</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Voucher Group Name"
              {...register("name", { required: "Name is required" })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                type="number"
                label="Number of Vouchers"
                {...register("amount", {
                  valueAsNumber: true,
                  min: 1,
                  max: 5000,
                  required: true,
                })}
                error={!!errors.amount}
                helperText={errors.amount ? "Enter 1–5000" : ""}
              />
              <TextField
                fullWidth
                type="number"
                label="Code Length"
                {...register("codeLength", {
                  valueAsNumber: true,
                  min: 6,
                  max: 10,
                  required: true,
                })}
                error={!!errors.codeLength}
                helperText={errors.codeLength ? "Enter 6–10" : ""}
              />
            </Stack>
            <Controller
              name="codeForm"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Code Character Type</InputLabel>
                  <Select
                    multiple
                    {...field}
                    label="Code Character Type"
                    renderValue={(v) =>
                      (v as number[])
                        .map((x) => (x === 0 ? "Numbers" : "Letters"))
                        .join(" + ")
                    }
                  >
                    <MenuItem value={0}>
                      <Checkbox checked={field.value.includes(0)} />
                      Numbers
                    </MenuItem>
                    <MenuItem value={1}>
                      <Checkbox checked={field.value.includes(1)} />
                      Letters
                    </MenuItem>
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="limitType"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Usage Limit</InputLabel>
                  <Select {...field} label="Usage Limit">
                    {VOUCHER_LIMIT_TYPES.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        {x.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {limit !== 2 && (
              <TextField
                type="number"
                label="Usage count / online users"
                {...register("limitNum", {
                  valueAsNumber: true,
                  min: 1,
                  required: true,
                })}
              />
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Controller
                name="durationType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Duration Type</InputLabel>
                    <Select {...field} label="Duration Type">
                      {DURATION_TYPES.map((x) => (
                        <MenuItem key={x.value} value={x.value}>
                          {x.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
              <TextField
                fullWidth
                type="number"
                label="Duration (minutes)"
                {...register("duration", {
                  valueAsNumber: true,
                  min: 1,
                  required: true,
                })}
              />
              <Controller
                name="timingType"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Timing Type</InputLabel>
                    <Select {...field} label="Timing Type">
                      {TIMING_TYPES.map((x) => (
                        <MenuItem key={x.value} value={x.value}>
                          {x.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Stack>
            <Controller
              name="trafficLimitEnable"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  label="Traffic limit"
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, v) => field.onChange(v)}
                    />
                  }
                />
              )}
            />
            {traffic && (
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label="Traffic Limit (MB)"
                  {...register("trafficLimit", { valueAsNumber: true, min: 1 })}
                />
                <Controller
                  name="trafficLimitFrequency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Frequency</InputLabel>
                      <Select {...field} label="Frequency">
                        {TRAFFIC_FREQUENCIES.map((x) => (
                          <MenuItem key={x.value} value={x.value}>
                            {x.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Stack>
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                fullWidth
                type="number"
                label="Price"
                {...register("unitPrice", { valueAsNumber: true, min: 0 })}
              />
              <TextField
                fullWidth
                label="Currency"
                {...register("currency", { required: true, maxLength: 3 })}
              />
            </Stack>
            <Controller
              name="portalId"
              control={control}
              rules={{ required: "Select a portal" }}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error}>
                  <InputLabel>Portal</InputLabel>
                  <Select {...field} label="Portal">
                    {portals.map((p) => (
                      <MenuItem
                        key={p.id || p.portalId}
                        value={p.id || p.portalId}
                      >
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="validityType"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Validity</InputLabel>
                  <Select {...field} label="Validity">
                    {VALIDITY_TYPES.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        {x.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {validity === 1 && (
              <Stack direction="row" spacing={2}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Effective Date/Time"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register("effectiveTime", { required: true })}
                />
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Expiration Date/Time"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register("expirationTime", {
                    required: true,
                    validate: (v) =>
                      !v ||
                      v > watch("effectiveTime")! ||
                      "Must be after effective time",
                  })}
                />
              </Stack>
            )}
            {validity === 2 && (
              <TextField
                label="Schedule"
                value="Daily · 00:00–23:59"
                slotProps={{ input: { readOnly: true } }}
              />
            )}
            <TextField
              label="Description"
              multiline
              minRows={2}
              {...register("description")}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" type="submit">
            Create voucher group
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
