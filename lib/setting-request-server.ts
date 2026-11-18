import type { SettingRequest } from "@prisma/client";
import { isPurpose, parseStatus, type SettingRequestData, type SettingRequestView } from "./setting-request";

/** Maksimal link per akun, supaya tabel tidak bisa diisi tanpa batas. */
export const MAX_REQUESTS_PER_USER = 500;

export function requestData(row: SettingRequest): SettingRequestData {
  return {
    purpose: isPurpose(row.purpose) ? row.purpose : "",
    modelId: row.modelId,
    businessName: row.businessName,
    email: row.email,
    phone: row.phone,
    templateId: row.templateId,
    needs: row.needs ?? "",
  };
}

/** Bentuk untuk halaman admin (pemilik link). */
export function requestToView(row: SettingRequest): SettingRequestView {
  return {
    ...requestData(row),
    id: row.id,
    token: row.token,
    label: row.label,
    status: parseStatus(row.status),
    routerPassword: row.routerPassword,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
