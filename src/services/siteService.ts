import { backend } from "./backendClient";
export interface OmadaSite {
  id: string;
  name: string;
  active: boolean;
}
export const listSites = () =>
  backend.get<OmadaSite[]>("/sites").then((r) => r.data);
