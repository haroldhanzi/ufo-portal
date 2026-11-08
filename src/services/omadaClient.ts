import axios, { AxiosError } from "axios";
import {
  backendBaseURL,
  getBearerToken,
  getOmadaConfig,
  sessionExpired,
} from "./backendClient";
export const getSiteId = () => getOmadaConfig().siteId;
export const api = axios.create({
  baseURL: `${backendBaseURL}/omada`,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});
api.interceptors.request.use((config) => {
  const token = getBearerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data.errorCode === "number" && data.errorCode !== 0)
      throw new OmadaError(
        data.msg || "Omada rejected the request",
        data.errorCode,
        data,
      );
    return response;
  },
  (error: AxiosError<{ msg?: string; message?: string }>) => {
    if (
      error.response?.status === 401 &&
      error.config?.headers?.Authorization === `Bearer ${getBearerToken()}`
    )
      sessionExpired();
    return Promise.reject(
      new OmadaError(
        error.response?.data?.msg ||
          error.response?.data?.message ||
          error.message ||
          "Unable to reach Omada",
        error.response?.status,
        error.response?.data,
      ),
    );
  },
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
export const sitePath = () => `/v1/sites/${encodeURIComponent(getSiteId())}`;
export const sitePathV2 = () => `/v2/sites/${encodeURIComponent(getSiteId())}`;
export const requireConfig = () => {
  if (!getSiteId())
    throw new OmadaError("The Omada site must be configured on the server.");
};
export function cleanPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanPayload) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as object)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, cleanPayload(v)]),
    ) as T;
  return value;
}
