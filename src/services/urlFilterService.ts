import { api, requireConfig, sitePath } from "./omadaClient";
import type {
  OmadaEnvelope,
  UrlFilter,
  UrlFilterForm,
  UrlFilterGrid,
} from "../types/omada";
import { buildUrlFilterRequest } from "./builders";

export async function listUrlFilters(page = 1, pageSize = 100) {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<UrlFilterGrid>>(
    `${sitePath()}/url-filters/gateway`,
    { params: { page, pageSize } },
  );
  return (
    data.result ?? {
      totalRows: 0,
      currentPage: page,
      currentSize: 0,
      data: [],
    }
  );
}

export async function createUrlFilter(form: UrlFilterForm) {
  return (
    await api.post(`${sitePath()}/url-filters`, buildUrlFilterRequest(form))
  ).data.result;
}

export async function updateUrlFilter(id: string, form: UrlFilterForm) {
  return api.patch(
    `${sitePath()}/url-filters/${encodeURIComponent(id)}`,
    buildUrlFilterRequest(form),
  );
}

export async function deleteUrlFilter(id: string) {
  return api.delete(`${sitePath()}/url-filters/${encodeURIComponent(id)}`);
}

export function toUrlFilterForm(rule: UrlFilter): UrlFilterForm {
  return {
    name: rule.name,
    status: rule.status,
    sourceIds: rule.sourceIds ?? [],
    urls: rule.urls ?? [],
  };
}
