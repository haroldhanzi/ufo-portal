import { api, OmadaError, requireConfig, sitePath } from "./omadaClient";
import type {
  OmadaEnvelope,
  Voucher,
  VoucherForm,
  VoucherGroup,
  VoucherGroupDetail,
} from "../types/omada";
import { buildCreateVoucherRequest } from "./builders";
interface Page {
  data: VoucherGroup[];
  total?: number;
}
export async function listVoucherGroups(
  page = 1,
  pageSize = 10,
  searchKey = "",
) {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<Page>>(
    `${sitePath()}/hotspot/voucher-groups`,
    { params: { page, pageSize, ...(searchKey ? { searchKey } : {}) } },
  );
  return data.result || { data: [] };
}
export async function createVoucherGroup(form: VoucherForm) {
  return (
    await api.post(
      `${sitePath()}/hotspot/voucher-groups`,
      buildCreateVoucherRequest(form),
    )
  ).data.result;
}
export async function getVoucher(id: string) {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<Voucher>>(
    `${sitePath()}/hotspot/vouchers/${encodeURIComponent(id)}`,
  );
  return data.result;
}
export async function findVoucher(identifier: string) {
  const value = identifier.trim();
  if (/^[a-f0-9]{24}$/i.test(value)) return getVoucher(value);
  const groups = await listVoucherGroups(1, 1000);
  const matches = await Promise.all(
    (groups.data || []).map((group) =>
      getVoucherGroupDetail(group.id, 1, 25, value).catch(() => null),
    ),
  );
  const vouchers = matches.flatMap((detail) => detail?.data || []);
  const match =
    vouchers.find(
      (voucher) => voucher.code.toLowerCase() === value.toLowerCase(),
    ) || vouchers[0];
  if (!match) throw new OmadaError(`No voucher was found for code “${value}”.`);
  return getVoucher(match.id);
}
export async function deleteVoucher(id: string) {
  requireConfig();
  return api.delete(`${sitePath()}/hotspot/vouchers/${encodeURIComponent(id)}`);
}
export async function getVoucherGroupDetail(
  groupId: string,
  page = 1,
  pageSize = 25,
  searchKey = "",
  status?: number,
) {
  requireConfig();
  const { data } = await api.get<OmadaEnvelope<VoucherGroupDetail>>(
    `${sitePath()}/hotspot/voucher-groups/${encodeURIComponent(groupId)}`,
    {
      params: {
        page,
        pageSize,
        "sorts.code": "asc",
        ...(searchKey ? { searchKey } : {}),
        ...(status === undefined ? {} : { "filters.status": status }),
      },
    },
  );
  return data.result;
}
export async function deleteSelectedVouchers(groupId: string, ids: string[]) {
  requireConfig();
  return api.post(`${sitePath()}/hotspot/vouchers/batch/delete`, {
    type: 1,
    ids,
    groupId,
  });
}
