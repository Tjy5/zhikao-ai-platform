import apiClient from './apiClient';
import type {
  AdminUserActiveUpdate,
  AdminUserListParams,
  AdminUserListResponse,
  AdminUserRoleUpdate,
  AdminUserSummary,
} from '../types/api';

function toQuery(params: AdminUserListParams): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.role) search.set('role', params.role);
  if (typeof params.active === 'boolean') search.set('active', String(params.active));
  if (typeof params.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params.offset === 'number') search.set('offset', String(params.offset));
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const adminUserService = {
  listUsers: async (
    params: AdminUserListParams = {}
  ): Promise<AdminUserListResponse> => {
    return apiClient.get<AdminUserListResponse>(
      `/api/v1/admin/users${toQuery(params)}`
    );
  },

  updateRole: async (
    userId: number,
    data: AdminUserRoleUpdate
  ): Promise<AdminUserSummary> => {
    return apiClient.patch<AdminUserSummary>(
      `/api/v1/admin/users/${userId}/role`,
      data
    );
  },

  updateActive: async (
    userId: number,
    data: AdminUserActiveUpdate
  ): Promise<AdminUserSummary> => {
    return apiClient.patch<AdminUserSummary>(
      `/api/v1/admin/users/${userId}/active`,
      data
    );
  },
};

export default adminUserService;
