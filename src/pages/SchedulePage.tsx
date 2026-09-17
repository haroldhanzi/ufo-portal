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
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import PageHeader from "../components/common/PageHeader";
import { ApiErrorAlert, Loading } from "../components/common/ApiFeedback";
import ActionsMenu from "../components/common/ActionsMenu";
import { DAY_MODES, DAYS, labelFor } from "../constants/omadaEnums";
import { createSchedule, listSchedules } from "../services/scheduleService";
import type { Schedule, ScheduleForm } from "../types/omada";
const times = Array.from(
  { length: 96 },
  (_, i) =>
    `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
);
const formatTime = (r: Schedule["timeList"][0]) =>
  `${String(r.startTimeH).padStart(2, "0")}:${String(r.startTimeM).padStart(2, "0")} – ${String(r.endTimeH).padStart(2, "0")}:${String(r.endTimeM).padStart(2, "0")}`;
export default function SchedulePage() {
  const [rows, setRows] = useState<Schedule[]>([]),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<unknown>();
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRows(await listSchedules());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async (v: ScheduleForm) => {
    setLoading(true);
    setError(undefined);
    try {
      await createSchedule(v);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Schedule Management"
        description="Create reusable operating windows for wireless networks."
        addLabel="Create Schedule"
        onAdd={() => setOpen(true)}
        onRefresh={load}
      />
      <ApiErrorAlert error={error} />
      <Loading show={loading} />
      <Paper className="table-wrap">
        <Table>
          <TableHead>
            <TableRow>
              {["Schedule Name", "Days", "Time", "Profile ID", "Actions"].map(
                (x) => (
                  <TableCell key={x}>{x}</TableCell>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.profileId}>
                <TableCell>
                  <b>{r.name}</b>
                </TableCell>
                <TableCell>{labelFor(DAY_MODES, r.dayMode)}</TableCell>
                <TableCell>
                  {r.timeList?.[0] ? formatTime(r.timeList[0]) : "—"}
                  {r.timeList?.length > 1 ? ` (+${r.timeList.length - 1})` : ""}
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                  {r.profileId}
                </TableCell>
                <TableCell>
                  <ActionsMenu
                    label={`Actions for ${r.name}`}
                    items={[
                      {
                        label: "View details",
                        disabled: true,
                        onClick: () => undefined,
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
                  No schedules found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
      <CreateSchedule
        open={open}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </>
  );
}
function CreateSchedule({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: ScheduleForm) => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ScheduleForm>({
    defaultValues: {
      name: "",
      dayMode: 1,
      days: [],
      startTime: "06:00",
      endTime: "22:00",
    },
  });
  const mode = watch("dayMode"),
    start = watch("startTime");
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSave)}>
        <DialogTitle>Create Schedule</DialogTitle>
        <DialogContent>
          <Stack spacing={2.2} mt={1}>
            <TextField
              label="Schedule Name"
              {...register("name", {
                required: "Schedule name is required",
                minLength: 1,
                maxLength: 64,
              })}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
            <Controller
              name="dayMode"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <InputLabel>Day mode</InputLabel>
                  <Select {...field} label="Day mode">
                    {DAY_MODES.map((x) => (
                      <MenuItem key={x.value} value={x.value}>
                        {x.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {mode === 3 && (
              <Controller
                name="days"
                control={control}
                rules={{
                  validate: (v) => v.length > 0 || "Select at least one day",
                }}
                render={({ field, fieldState }) => (
                  <FormControl error={!!fieldState.error}>
                    <Stack direction="row" flexWrap="wrap">
                      {DAYS.map((d) => (
                        <FormControlLabel
                          key={d.value}
                          label={d.label}
                          control={
                            <Checkbox
                              checked={field.value.includes(d.value)}
                              onChange={(_, yes) =>
                                field.onChange(
                                  yes
                                    ? [...field.value, d.value]
                                    : field.value.filter((x) => x !== d.value),
                                )
                              }
                            />
                          }
                        />
                      ))}
                    </Stack>
                    {fieldState.error?.message}
                  </FormControl>
                )}
              />
            )}
            <Stack direction="row" spacing={2}>
              <Controller
                name="startTime"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Start Time</InputLabel>
                    <Select {...field} label="Start Time">
                      {times.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
              <Controller
                name="endTime"
                control={control}
                rules={{
                  validate: (v) =>
                    v > start || "End time must be later than start time",
                }}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth error={!!fieldState.error}>
                    <InputLabel>End Time</InputLabel>
                    <Select {...field} label="End Time">
                      {times.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error?.message}
                  </FormControl>
                )}
              />
            </Stack>
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
            Create schedule
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
