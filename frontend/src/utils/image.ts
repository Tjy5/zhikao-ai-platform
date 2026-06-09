/**
 * 图片地址解析工具
 * - 统一处理后端返回的相对路径
 * - 避免浏览器以前端域名请求导致 400/404
 */

import { API_BASE_URL } from '../config/api';

const ABSOLUTE_PROTOCOL_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

export const resolveImageUrl = (url?: string): string => {
  if (!url) return '';
  if (ABSOLUTE_PROTOCOL_REGEX.test(url)) {
    return url;
  }

  const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${normalizedBase}${normalizedPath}`;
};
