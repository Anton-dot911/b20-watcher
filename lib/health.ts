import { B20_NETWORK, DATA_SOURCE, MOCK_MODE, dataModeLabel } from "./config";

export interface HealthSnapshot {
  ok: true;
  service: "b20-watcher";
  mockMode: boolean;
  dataSource: typeof DATA_SOURCE;
  network: typeof B20_NETWORK;
  modeLabel: string;
  generatedAt: string;
}

/**
 * Small, secret-free runtime snapshot for health checks and deployment smoke tests.
 * It intentionally does not touch CDP or Supabase so it remains safe and fast.
 */
export function getHealthSnapshot(now: Date = new Date()): HealthSnapshot {
  return {
    ok: true,
    service: "b20-watcher",
    mockMode: MOCK_MODE,
    dataSource: DATA_SOURCE,
    network: B20_NETWORK,
    modeLabel: dataModeLabel(),
    generatedAt: now.toISOString(),
  };
}
