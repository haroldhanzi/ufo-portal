import { createContext, useContext } from "react";
import type { BackendUser } from "../../services/backendClient";
export const AuthContext = createContext<
  { user: BackendUser; logout: () => Promise<void> } | undefined
>(undefined);
export function useBackendAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Sign in required");
  return auth;
}
