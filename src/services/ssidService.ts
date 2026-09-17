import { api, requireConfig, sitePath, sitePathV2 } from "./omadaClient";
import type {
  OmadaEnvelope,
  Schedule,
  Ssid,
  SsidGroup,
  WifiForm,
} from "../types/omada";
import { buildCreateSsidRequest, buildPasswordUpdate } from "./builders";
export async function listSsids() {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<SsidGroup[]>>(
    `${sitePath()}/wireless-network/ssids`,
    { params: { type: 3 } },
  );
  const unique = normalizeSsidRows(data.result || []);
  return Promise.all(
    unique.map(async (ssid) => {
      try {
        const detail = await getSsid(ssid.wlanId!, ssid.ssidId || ssid.id!);
        return { ...ssid, ...detail, wlanId: ssid.wlanId };
      } catch {
        return ssid;
      }
    }),
  );
}
export function normalizeSsidRows(groups: SsidGroup[]) {
  const rows = groups
    .filter((group) => group.wlanId !== "gateway")
    .flatMap((g) =>
      (g.ssidList || []).map((s) => ({
        ...s,
        name: s.name || s.ssidName || "Unnamed WiFi",
        wlanId: s.wlanId || g.wlanId,
      })),
    );
  const unique = [
    ...new Map(rows.map((ssid) => [ssid.ssidId || ssid.id, ssid])).values(),
  ];
  return unique;
}
export async function getSsid(wlanId: string, ssidId: string) {
  const { data } = await api.get<OmadaEnvelope<Ssid>>(
    `${sitePath()}/wireless-network/wlans/${wlanId}/ssids/${ssidId}`,
  );
  return data.result;
}
export async function createSsid(form: WifiForm) {
  return (
    await api.post(
      `${sitePathV2()}/wireless-network/ssids`,
      buildCreateSsidRequest(form),
    )
  ).data.result;
}
export async function changePassword(ssid: Ssid, password: string) {
  const current = await getSsid(ssid.wlanId!, ssid.ssidId || ssid.id!);
  return api.patch(
    `${sitePath()}/wireless-network/ssids/${ssid.ssidId || ssid.id}/basic-config`,
    buildPasswordUpdate(current, password),
  );
}
export async function assignSchedule(
  ssidId: string,
  enabled: boolean,
  schedule: Schedule | null,
  action: number,
) {
  return api.patch(
    `${sitePath()}/wireless-network/ssids/${ssidId}/wlan-schedule`,
    {
      wlanScheduleEnable: enabled,
      ...(enabled ? { action, scheduleId: schedule!.profileId } : {}),
    },
  );
}
export async function deleteSsid(id: string) {
  return api.delete(`${sitePath()}/wireless-network/ssids/${id}`);
}
