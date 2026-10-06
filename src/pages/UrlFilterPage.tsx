import { useCallback, useEffect, useMemo, useState } from "react";
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
  FormHelperText,
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
import { Controller, useForm } from "react-hook-form";
import ActionsMenu from "../components/common/ActionsMenu";
import { ApiErrorSnackbar, Loading } from "../components/common/ApiFeedback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import PageHeader from "../components/common/PageHeader";
import { listSsids } from "../services/ssidService";
import {
  createUrlFilter,
  deleteUrlFilter,
  listUrlFilters,
  toUrlFilterForm,
  updateUrlFilter,
} from "../services/urlFilterService";
import type { Ssid, UrlFilter, UrlFilterForm } from "../types/omada";

interface BlacklistFields {
  name: string;
  status: boolean;
  sourceIds: string[];
  urlsText: string;
}

export default function UrlFilterPage() {
  const [rows, setRows] = useState<UrlFilter[]>([]);
  const [ssids, setSsids] = useState<Ssid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UrlFilter | null>(null);
  const [deleting, setDeleting] = useState<UrlFilter | null>(null);
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [filterGrid, wifiNetworks] = await Promise.all([
        listUrlFilters(),
        listSsids(),
      ]);
      setRows(filterGrid.data ?? []);
      setSsids(wifiNetworks);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (form: UrlFilterForm) => {
    setLoading(true);
    setError(undefined);
    try {
      if (editing) await updateUrlFilter(editing.id, form);
      else await createUrlFilter(form);
      setFormOpen(false);
      setEditing(null);
      await load();
      setSuccess(
        editing
          ? "Blacklist updated successfully."
          : "Blacklist created successfully.",
      );
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setLoading(true);
    setError(undefined);
    try {
      await deleteUrlFilter(deleting.id);
      setDeleting(null);
      await load();
      setSuccess("Blacklist deleted successfully.");
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };

  const wifiNames = (ids: string[]) =>
    ids
      .map(
        (id) =>
          ssids.find((ssid) => (ssid.ssidId || ssid.id) === id)?.name || id,
      )
      .join(", ");

  return (
    <>
      <PageHeader
        title="Websites Blacklist Management"
        description="Block selected websites on one or more WiFi networks."
        addLabel="Add New Blacklist"
        onAdd={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onRefresh={load}
      />
      <ApiErrorSnackbar error={error} onClose={() => setError(undefined)} />
      <Loading show={loading} />
      <Paper className="table-wrap">
        <Table>
          <TableHead>
            <TableRow>
              {[
                "List Name",
                "Status",
                "Source WiFi",
                "Blocked Sites",
                "Actions",
              ].map((heading) => (
                <TableCell key={heading}>{heading}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <b>{rule.name}</b>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={rule.status ? "success" : "default"}
                    label={rule.status ? "Enabled" : "Disabled"}
                  />
                </TableCell>
                <TableCell>{wifiNames(rule.sourceIds) || "None"}</TableCell>
                <TableCell sx={{ maxWidth: 360 }}>
                  <Tooltip title={rule.urls.join(", ")}>
                    <span>
                      {rule.urls.length
                        ? `${rule.urls.slice(0, 3).join(", ")}${rule.urls.length > 3 ? ` (+${rule.urls.length - 3})` : ""}`
                        : "None"}
                    </span>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${rule.name}`}
                    items={[
                      {
                        label: "Edit List",
                        onClick: () => {
                          setEditing(rule);
                          setFormOpen(true);
                        },
                      },
                      {
                        label: "Delete List",
                        color: "error",
                        onClick: () => setDeleting(rule),
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
                  No website blacklists found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      {formOpen && (
        <BlacklistDialog
          key={editing?.id || "new"}
          rule={editing}
          ssids={ssids}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.name || ""}”?`}
        body="This blacklist will be permanently removed."
        busy={loading}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
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

function BlacklistDialog({
  rule,
  ssids,
  onClose,
  onSave,
}: {
  rule: UrlFilter | null;
  ssids: Ssid[];
  onClose: () => void;
  onSave: (form: UrlFilterForm) => void;
}) {
  const defaults = useMemo(() => {
    const form = rule
      ? toUrlFilterForm(rule)
      : { name: "", status: true, sourceIds: [], urls: [] };
    return {
      name: form.name,
      status: form.status,
      sourceIds: form.sourceIds,
      urlsText: form.urls.join("\n"),
    };
  }, [rule]);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BlacklistFields>({ defaultValues: defaults });

  const submit = (values: BlacklistFields) => {
    const urls = values.urlsText
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    onSave({
      name: values.name.trim(),
      status: values.status,
      sourceIds: values.sourceIds,
      urls,
    });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(submit)}>
        <DialogTitle>
          {rule ? "Edit Blacklist" : "Add New Blacklist"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} mt={1}>
            <TextField
              label="List Name"
              {...register("name", {
                required: "List name is required",
                maxLength: {
                  value: 64,
                  message: "List name cannot exceed 64 characters",
                },
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  label="Enabled"
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                    />
                  }
                />
              )}
            />
            <Controller
              name="sourceIds"
              control={control}
              rules={{
                validate: (value) =>
                  value.length > 0 || "Select at least one WiFi network",
              }}
              render={({ field, fieldState }) => (
                <FormControl error={!!fieldState.error}>
                  <InputLabel>Source WiFi</InputLabel>
                  <Select
                    {...field}
                    multiple
                    label="Source WiFi"
                    renderValue={(selected) =>
                      (selected as string[])
                        .map(
                          (id) =>
                            ssids.find(
                              (ssid) => (ssid.ssidId || ssid.id) === id,
                            )?.name || id,
                        )
                        .join(", ")
                    }
                  >
                    {ssids.map((ssid) => {
                      const id = ssid.ssidId || ssid.id!;
                      return (
                        <MenuItem key={id} value={id}>
                          <Checkbox checked={field.value.includes(id)} />
                          <ListItemText primary={ssid.name} />
                        </MenuItem>
                      );
                    })}
                  </Select>
                  <FormHelperText>{fieldState.error?.message}</FormHelperText>
                </FormControl>
              )}
            />
            <TextField
              label="Blocked Sites"
              placeholder={"example.com\nanother-site.com"}
              multiline
              minRows={5}
              {...register("urlsText", {
                required: "Enter at least one website",
                validate: (value) =>
                  value
                    .split(/[\n,]+/)
                    .some((entry) => entry.trim().length > 0) ||
                  "Enter at least one website",
              })}
              error={!!errors.urlsText}
              helperText={
                errors.urlsText?.message || "Enter one domain or URL per line."
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {rule ? "Save changes" : "Create blacklist"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
