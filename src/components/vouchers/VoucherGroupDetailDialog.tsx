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
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { ApiErrorAlert, Loading } from "../common/ApiFeedback";
import ConfirmDialog from "../common/ConfirmDialog";
import ActionsMenu from "../common/ActionsMenu";
import type { VoucherGroup, VoucherGroupDetail } from "../../types/omada";
import {
  deleteSelectedVouchers,
  deleteVoucher,
  getVoucherGroupDetail,
} from "../../services/voucherService";

const STATUSES = [
  { value: 0, label: "Unused", color: "default" as const },
  { value: 1, label: "In use", color: "success" as const },
  { value: 2, label: "Expired", color: "error" as const },
];
const statusInfo = (value: number) =>
  STATUSES.find((item) => item.value === value) || {
    label: "Unknown",
    color: "default" as const,
  };
const bytes = (value: number) =>
  value ? `${(value / 1024 / 1024).toFixed(1)} MB` : "0 MB";
const duration = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

export default function VoucherGroupDetailDialog({
  group,
  onClose,
  onChanged,
}: {
  group: VoucherGroup | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<VoucherGroupDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<number | "">("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [confirm, setConfirm] = useState<"selected" | string | null>(null);
  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError(undefined);
    try {
      setDetail(
        await getVoucherGroupDetail(
          group.id,
          1,
          25,
          search,
          status === "" ? undefined : status,
        ),
      );
      setSelected([]);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [group, search, status]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!group) return null;
  const rows = detail?.data || [];
  const all =
    rows.length > 0 && rows.every((voucher) => selected.includes(voucher.id));
  const remove = async () => {
    if (!confirm) return;
    setLoading(true);
    setError(undefined);
    try {
      if (confirm === "selected")
        await deleteSelectedVouchers(group.id, selected);
      else await deleteVoucher(confirm);
      setConfirm(null);
      await load();
      onChanged();
    } catch (requestError) {
      setError(requestError);
      setLoading(false);
      setConfirm(null);
    }
  };
  return (
    <>
      <Dialog open fullWidth maxWidth="lg" onClose={onClose}>
        <DialogTitle>{group.name} vouchers</DialogTitle>
        <DialogContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ mb: 2, mt: 1 }}
          >
            <TextField
              size="small"
              fullWidth
              label="Search voucher code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(event) =>
                  setStatus(event.target.value as number | "")
                }
              >
                <MenuItem value="">All statuses</MenuItem>
                {STATUSES.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={() => void load()}>
              Refresh
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={!selected.length}
              onClick={() => setConfirm("selected")}
            >
              Delete selected ({selected.length})
            </Button>
          </Stack>
          <ApiErrorAlert error={error} />
          <Loading show={loading} />
          {detail && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {detail.totalCount} vouchers · {detail.unusedCount} unused ·{" "}
              {detail.inUseCount} in use · {detail.expiredCount} expired
            </Typography>
          )}
          <div className="table-wrap">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={all}
                      indeterminate={selected.length > 0 && !all}
                      onChange={(_, checked) =>
                        setSelected(
                          checked ? rows.map((voucher) => voucher.id) : [],
                        )
                      }
                    />
                  </TableCell>
                  {[
                    "Code",
                    "Status",
                    "Traffic used",
                    "Time used",
                    "Time left",
                    "Started",
                    "Actions",
                  ].map((heading) => (
                    <TableCell key={heading}>{heading}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((voucher) => {
                  const info = statusInfo(voucher.status);
                  return (
                    <TableRow key={voucher.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.includes(voucher.id)}
                          onChange={(_, checked) =>
                            setSelected(
                              checked
                                ? [...selected, voucher.id]
                                : selected.filter((id) => id !== voucher.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <b>{voucher.code}</b>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={info.color}
                          label={info.label}
                        />
                      </TableCell>
                      <TableCell>{bytes(voucher.trafficUsed)}</TableCell>
                      <TableCell>
                        {voucher.timingByClientUsage
                          ? "By client"
                          : duration(voucher.timeUsedSec)}
                      </TableCell>
                      <TableCell>
                        {voucher.timingByClientUsage
                          ? "—"
                          : duration(voucher.timeLeftSec)}
                      </TableCell>
                      <TableCell>
                        {voucher.startTime
                          ? new Date(voucher.startTime).toLocaleString()
                          : "Not used"}
                      </TableCell>
                      <TableCell>
                        <ActionsMenu
                          label={`Actions for voucher ${voucher.code}`}
                          items={[
                            {
                              label: "Delete voucher",
                              color: "error",
                              onClick: () => setConfirm(voucher.id),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      No vouchers match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm === "selected"
            ? `Delete ${selected.length} selected vouchers?`
            : "Delete this voucher?"
        }
        body="The selected voucher access will stop immediately. This action cannot be undone."
        busy={loading}
        onClose={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}
