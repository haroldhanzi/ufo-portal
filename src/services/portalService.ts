import { api, OmadaError, requireConfig, sitePath } from "./omadaClient";
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
  welcomeInformation: string,
  backgroundFile?: File,
) {
  const backgroundPicture = backgroundFile
    ? await uploadPortalBackground(backgroundFile)
    : undefined;
  const portalCustomize = {
    ...(portal.portalCustomize ?? {}),
    ...(backgroundPicture ? { backgroundPictureId: backgroundPicture.id } : {}),
    defaultLanguage: portal.portalCustomize?.defaultLanguage ?? 1,
    logoDisplay,
    welcomeEnable: welcomeInformation.trim().length > 0,
    welcomeInformation: welcomeInformation.trim(),
    termsOfServiceEnable: portal.portalCustomize?.termsOfServiceEnable ?? false,
    copyrightEnable: portal.portalCustomize?.copyrightEnable ?? false,
  };
  return api.patch(
    `${sitePath()}/portal/${portal.id || portal.portalId}`,
    buildPortalUpdate(portal, portal.ssidList, portalCustomize),
  );
}
export async function uploadPortalBackground(file: File) {
  requireConfig();
  if (!file.type.startsWith("image/") || file.size === 0) {
    throw new OmadaError("Choose a non-empty image file for the background.");
  }
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<
    OmadaEnvelope<{ id: string; fileName: string; url: string }>
  >(`${sitePath()}/portal/pics`, form, {
    params: { type: "background" },
    headers: { "Content-Type": undefined },
  });
  if (!data.result?.id) {
    throw new OmadaError("Omada did not return a background picture ID.");
  }
  return data.result;
}
export async function deletePortal(id: string) {
  return api.delete(`${sitePath()}/portal/${id}`);
}
