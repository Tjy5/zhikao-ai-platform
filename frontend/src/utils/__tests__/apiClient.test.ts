import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../apiClient';
import { saveStoredAuthToken } from '../../services/authSession';

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('performs a GET request correctly', async () => {
    const mockResponse = { data: 'test' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await apiClient.get('/test');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('performs a POST request with data', async () => {
    const mockResponse = { success: true };
    const payload = { key: 'value' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const result = await apiClient.post('/test', payload);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('handles API errors correctly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const request = apiClient.get('/test');

    await expect(request).rejects.toThrow(ApiError);
    await expect(request).rejects.toThrow('HTTP error! status: 404 Not Found');
  });

  it('attaches stored bearer credentials to API requests', async () => {
    saveStoredAuthToken({
      access_token: 'token-abc',
      token_type: 'bearer',
      expires_in: 3600,
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await apiClient.get('/protected');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/protected'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-abc',
        }),
      })
    );
  });
});
