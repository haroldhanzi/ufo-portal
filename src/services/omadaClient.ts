import axios, { AxiosError } from "axios";
const omadaBaseURL =
  import.meta.env.VITE_OMADA_BASE_URL ||
  "https://euw1-omada-northbound.tplinkcloud.com";
const baseURL = import.meta.env.DEV ? "/omada-api" : "/api/omada";
export const omadaId =
  import.meta.env.VITE_OMADA_ID || "caaaa331cf6e876e8fea7403e00e7ff6";
const defaultSiteId =
  import.meta.env.VITE_OMADA_SITE_ID || "6a4eb57c543849228eba7341";
const clientId =
  import.meta.env.VITE_OMADA_CLIENT_ID || "f39dc9be33dd464cb7fce8a7a5756fd7";
const clientSecret =
  import.meta.env.VITE_OMADA_CLIENT_SECRET ||
  "9719d73c0d4c493997ec55d781ef1d7b";
export const getSiteId = () =>
  sessionStorage.getItem("omadaSiteId") || defaultSiteId;
export const setSiteId = (siteId: string) =>
  sessionStorage.setItem("omadaSiteId", siteId.trim());
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});
api.interceptors.request.use(async (config) => {
  const expiresAt = Number(sessionStorage.getItem("omadaTokenExpiresAt") || 0);
  if (expiresAt && Date.now() >= expiresAt - 60000) await refreshAccessToken();
  const token = sessionStorage.getItem("omadaAccessToken");
  if (token) config.headers.Authorization = `AccessToken=${token}`;
  return config;
});
api.interceptors.response.use(
  async (response) => {
    const data = response.data;
    if (
      data?.errorCode === -44112 &&
      !(response.config as typeof response.config & { _tokenRetried?: boolean })
        ._tokenRetried
    ) {
      const retryConfig = response.config as typeof response.config & {
        _tokenRetried?: boolean;
      };
      retryConfig._tokenRetried = true;
      await refreshAccessToken();
      return api.request(retryConfig);
    }
    if (data && typeof data.errorCode === "number" && data.errorCode !== 0)
      throw new OmadaError(
        data.msg || "Omada rejected the request",
        data.errorCode,
        data,
      );
    return response;
  },
  (error: AxiosError<{ msg?: string }>) =>
    Promise.reject(
      new OmadaError(
        error.response?.data?.msg || error.message || "Unable to reach Omada",
        error.response?.status,
        error.response?.data,
      ),
    ),
);
export class OmadaError extends Error {
  constructor(
    message: string,
    public code?: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "OmadaError";
  }
}
export const sitePath = () => `/openapi/v1/${omadaId}/sites/${getSiteId()}`;
export const sitePathV2 = () => `/openapi/v2/${omadaId}/sites/${getSiteId()}`;
export const requireConfig = () => {
  if (!omadaBaseURL || !omadaId || !getSiteId())
    throw new OmadaError(
      "Omada base URL, controller ID, and site ID must be configured in the environment.",
    );
};
type TokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};
function saveToken(result: TokenResult) {
  sessionStorage.setItem("omadaAccessToken", result.accessToken);
  if (result.refreshToken)
    sessionStorage.setItem("omadaRefreshToken", result.refreshToken);
  sessionStorage.setItem(
    "omadaTokenExpiresAt",
    String(Date.now() + (result.expiresIn || 7200) * 1000),
  );
  return result.accessToken;
}
async function tokenRequest(grantType: "client_credentials" | "refresh_token") {
  requireConfig();
  if (!clientId || !clientSecret)
    throw new OmadaError(
      "Omada client ID and client secret must be configured in the environment.",
    );
  try {
    const refreshToken =
      sessionStorage.getItem("omadaRefreshToken") || undefined;
    const { data } = await axios.post(
      `${baseURL}/openapi/authorize/token`,
      grantType === "refresh_token"
        ? { client_id: clientId, client_secret: clientSecret }
        : {
            omadacId: omadaId,
            client_id: clientId,
            client_secret: clientSecret,
          },
      {
        params: {
          grant_type: grantType,
          ...(grantType === "refresh_token"
            ? { refresh_token: refreshToken }
            : {}),
        },
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      },
    );
    if (data?.errorCode !== undefined && data.errorCode !== 0)
      throw new OmadaError(
        data.msg || "Omada rejected the credentials.",
        data.errorCode,
        data,
      );
    const result = data?.result;
    if (!result?.accessToken)
      throw new OmadaError(
        "Omada did not return an access token.",
        undefined,
        data,
      );
    return saveToken(result);
  } catch (error) {
    if (error instanceof OmadaError) throw error;
    const e = error as AxiosError<{ msg?: string }>;
    throw new OmadaError(
      e.response?.data?.msg ||
        e.message ||
        "Unable to request an access token.",
      e.response?.status,
      e.response?.data,
    );
  }
}
export const requestAccessToken = () => tokenRequest("client_credentials");
let automaticTokenRequest: Promise<string> | undefined;
export function refreshAccessToken() {
  if (!automaticTokenRequest) {
    const hasRefreshToken = !!sessionStorage.getItem("omadaRefreshToken");
    automaticTokenRequest = (
      hasRefreshToken
        ? tokenRequest("refresh_token")
        : tokenRequest("client_credentials")
    )
      .catch(() => tokenRequest("client_credentials"))
      .finally(() => {
        automaticTokenRequest = undefined;
      });
  }
  return automaticTokenRequest;
}
export function ensureAccessToken() {
  const existing = sessionStorage.getItem("omadaAccessToken");
  const expiresAt = Number(sessionStorage.getItem("omadaTokenExpiresAt") || 0);
  if (existing && (!expiresAt || Date.now() < expiresAt - 60000))
    return Promise.resolve(existing);
  return refreshAccessToken();
}
export function cleanPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanPayload) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as object)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, cleanPayload(v)]),
    ) as T;
  }
  return value;
}
