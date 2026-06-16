import { useCallback, useEffect, useRef, useState } from 'react';
import settingsService from '../services/settingsService';
import type { OperationPolicySettings } from '../types/api';

export type AdminPolicyPhase = 'loading' | 'ready' | 'error';

export interface UseAdminOperationPolicyResult {
  phase: AdminPolicyPhase;
  policy: OperationPolicySettings | null;
  error: string | null;
  reload: () => void;
}

function friendlyMessage(error: unknown): string {
  return error instanceof Error ? error.message : '无法读取平台运营策略';
}

export function useAdminOperationPolicy(): UseAdminOperationPolicyResult {
  const [phase, setPhase] = useState<AdminPolicyPhase>('loading');
  const [policy, setPolicy] = useState<OperationPolicySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const requestIdRef = useRef(0);

  const reload = useCallback(() => {
    setPhase('loading');
    setReloadTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reqId = ++requestIdRef.current;
    void (async () => {
      try {
        const settings = await settingsService.getAdminSettings();
        if (cancelled || reqId !== requestIdRef.current) return;
        setPolicy(settings.operation_policy);
        setError(null);
        setPhase('ready');
      } catch (err) {
        if (cancelled || reqId !== requestIdRef.current) return;
        setPolicy(null);
        setError(friendlyMessage(err));
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  return { phase, policy, error, reload };
}

export default useAdminOperationPolicy;
