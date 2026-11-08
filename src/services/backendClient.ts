import axios from "axios";
export const backendBaseURL =
  import.meta.env.VITE_BACKEND_BASE_URL || "/backend-api";
export const backend = axios.create({
  baseURL: backendBaseURL,
  timeout: 30000,
});
export const getBearerToken = () => sessionStorage.getItem("ufoBearerToken");
export function clearBackendSession() {
  sessionStorage.removeItem("ufoBearerToken");
  [
    "omadaAccessToken",
    "omadaRefreshToken",
    "omadaTokenExpiresAt",
    "omadaSiteId",
  ].forEach((k) => sessionStorage.removeItem(k));
}
export function sessionExpired() {
  clearBackendSession();
  window.dispatchEvent(new Event("backend-session-expired"));
}
backend.interceptors.request.use((config) => {
  const token = getBearerToken();
  if (token && config.url !== "/auth/login")
    config.headers.Authorization = `Bearer ${token}`;
  return config;
});
backend.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.url !== "/auth/login" &&
      error.config?.headers?.Authorization === `Bearer ${getBearerToken()}`
    )
      sessionExpired();
    return Promise.reject(
      new Error(
        error.response?.data?.errors?.join(", ") ||
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message,
      ),
    );
  },
);
export interface BackendUser {
  id: number;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "PORTAL_PARTNER";
  siteId: string | null;
  siteName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface BackendPage<T> {
  content: T[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}
export interface OmadaConfig {
  siteId: string;
  siteName: string;
}
let config: OmadaConfig = { siteId: "", siteName: "UFO Location" };
export const getOmadaConfig = () => config;
export const loadOmadaConfig = async () => {
  config = (await backend.get<OmadaConfig>("/auth/config")).data;
};
export const currentUser = () =>
  backend.get<BackendUser>("/auth/me").then((r) => r.data);
export const signIn = async (email: string, password: string) => {
  const { data } = await backend.post<{
    accessToken: string;
    tokenType: string;
    user: BackendUser;
  }>("/auth/login", { email, password });
  clearBackendSession();
  sessionStorage.setItem("ufoBearerToken", data.accessToken);
  return data.user;
};
export const signOut = async () => {
  try {
    await backend.post("/auth/logout");
  } finally {
    sessionExpired();
  }
};
