import { api, requireConfig, sitePath } from "./omadaClient";
import type { OmadaEnvelope, Schedule, ScheduleForm } from "../types/omada";
import { buildCreateScheduleRequest } from "./builders";
const messages: Record<number, string> = {
  [-33709]: "A schedule with this name already exists.",
  [-33716]: "End time must be later than start time.",
  [-33723]: "The schedule profile limit has been reached.",
  [-33731]: "The time range may not be empty.",
  [-33748]: "This schedule contains too many time ranges.",
  [-33799]: "The schedule parameters are invalid.",
};
export async function listSchedules() {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<Schedule[]>>(
    `${sitePath()}/time-range-profiles`,
  );
  return data.result || [];
}
export async function createSchedule(form: ScheduleForm) {
  try {
    return (
      await api.post(
        `${sitePath()}/time-range-profiles`,
        buildCreateScheduleRequest(form),
      )
    ).data.result;
  } catch (e) {
    if (e instanceof Error && "code" in e && messages[Number(e.code)])
      e.message = messages[Number(e.code)];
    throw e;
  }
}
