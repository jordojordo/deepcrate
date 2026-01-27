import {
  describe, it, expect, vi, beforeEach, afterEach 
} from 'vitest';
import type { Request, Response } from 'express';

// Mock getConfig while preserving other exports
vi.mock('@server/config/settings', async(importOriginal) => {
  const actual = await importOriginal<typeof import('@server/config/settings')>();

  return {
    ...actual,
    getConfig: vi.fn(),
  };
});

import { getConfig } from '@server/config/settings';
import AuthController from './AuthController';

const mockGetConfig = vi.mocked(getConfig);

function createMockResponse(): Response {
  const res = { json: vi.fn().mockReturnThis() } as unknown as Response;

  return res;
}

function createMockRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getInfo', () => {
    it('returns disabled when auth is not enabled', () => {
      mockGetConfig.mockReturnValue({ ui: { auth: { enabled: false, type: 'basic' } } } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getInfo(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: false,
        type:    'disabled',
      });
    });

    it('returns basic auth type when enabled with basic', () => {
      mockGetConfig.mockReturnValue({
        ui: {
          auth: {
            enabled: true, type: 'basic', username: 'admin', password: 'secret' 
          } 
        }, 
      } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getInfo(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: true,
        type:    'basic',
      });
    });

    it('returns api_key auth type when enabled with api_key', () => {
      mockGetConfig.mockReturnValue({
        ui: {
          auth: {
            enabled: true, type: 'api_key', api_key: 'secret-key' 
          } 
        }, 
      } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getInfo(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: true,
        type:    'api_key',
      });
    });

    it('returns proxy auth type when enabled with proxy', () => {
      mockGetConfig.mockReturnValue({ ui: { auth: { enabled: true, type: 'proxy' } } } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getInfo(req, res);

      expect(res.json).toHaveBeenCalledWith({
        enabled: true,
        type:    'proxy',
      });
    });
  });

  describe('getMe', () => {
    it('returns Guest when auth is disabled', () => {
      mockGetConfig.mockReturnValue({ ui: { auth: { enabled: false, type: 'basic' } } } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getMe(req, res);

      expect(res.json).toHaveBeenCalledWith({ username: 'Guest' });
    });

    it('returns configured username for basic auth', () => {
      mockGetConfig.mockReturnValue({
        ui: {
          auth: {
            enabled: true, type: 'basic', username: 'admin', password: 'secret' 
          } 
        }, 
      } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getMe(req, res);

      expect(res.json).toHaveBeenCalledWith({ username: 'admin' });
    });

    it('returns API User for api_key auth', () => {
      mockGetConfig.mockReturnValue({
        ui: {
          auth: {
            enabled: true, type: 'api_key', api_key: 'secret-key' 
          } 
        }, 
      } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getMe(req, res);

      expect(res.json).toHaveBeenCalledWith({ username: 'API User' });
    });

    it('returns Remote-User header value for proxy auth', () => {
      mockGetConfig.mockReturnValue({ ui: { auth: { enabled: true, type: 'proxy' } } } as ReturnType<typeof getConfig>);

      const req = createMockRequest({ 'remote-user': 'john.doe' });
      const res = createMockResponse();

      AuthController.getMe(req, res);

      expect(res.json).toHaveBeenCalledWith({ username: 'john.doe' });
    });

    it('returns Proxy User when Remote-User header is missing for proxy auth', () => {
      mockGetConfig.mockReturnValue({ ui: { auth: { enabled: true, type: 'proxy' } } } as ReturnType<typeof getConfig>);

      const req = createMockRequest();
      const res = createMockResponse();

      AuthController.getMe(req, res);

      expect(res.json).toHaveBeenCalledWith({ username: 'Proxy User' });
    });
  });
});
