import { api, requireConfig, sitePath } from "./omadaClient";
import type { OmadaEnvelope, Portal, PortalForm } from "../types/omada";
import { buildCreatePortalRequest, buildPortalUpdate } from "./builders";
export async function listPortals() {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<Portal[]>>(
    `${sitePath()}/portals`,
  );
  return data.result || [];
}
export async function createPortal(form: PortalForm) {
  return (
    await api.post(`${sitePath()}/portal`, buildCreatePortalRequest(form))
  ).data.result;
}
export async function updatePortal(portal: Portal, ssidList: string[]) {
  return api.patch(
    `${sitePath()}/portal/${portal.id || portal.portalId}`,
    buildPortalUpdate(portal, ssidList),
  );
}
export async function updatePortalAppearance(
  portal: Portal,
  logoDisplay: boolean,
) {
  const portalCustomize = {
    ...(portal.portalCustomize ?? {}),
    defaultLanguage: portal.portalCustomize?.defaultLanguage ?? 1,
    logoDisplay,
    welcomeEnable: portal.portalCustomize?.welcomeEnable ?? false,
    termsOfServiceEnable:
      portal.portalCustomize?.termsOfServiceEnable ?? false,
    copyrightEnable: portal.portalCustomize?.copyrightEnable ?? false,
  };
  return api.patch(
    `${sitePath()}/portal/${portal.id || portal.portalId}`,
    buildPortalUpdate(portal, portal.ssidList, portalCustomize),
  );
}
export async function deletePortal(id: string) {
  return api.delete(`${sitePath()}/portal/${id}`);
}
