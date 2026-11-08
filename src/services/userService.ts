import { backend, type BackendPage, type BackendUser } from "./backendClient";
export type UserInput = Pick<BackendUser, "name" | "email" | "role" | "siteId">;
export const listUsers = (page = 0, search = "") =>
  backend
    .get<
      BackendPage<BackendUser>
    >("/users", { params: { page, size: 25, search } })
    .then((r) => r.data);
export const createUser = (input: UserInput & { password: string }) =>
  backend.post("/users", input);
export const updateUser = (id: number, input: UserInput) =>
  backend.put(`/users/${id}`, input);
export const setUserEnabled = (id: number, enabled: boolean) =>
  backend.patch(`/users/${id}/enabled`, { enabled });
export const resetUserPassword = (id: number, password: string) =>
  backend.put(`/users/${id}/password`, { password });
