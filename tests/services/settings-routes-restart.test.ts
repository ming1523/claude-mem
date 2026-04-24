import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

const spawnedChildren: Array<{ unref: ReturnType<typeof mock> }> = [];
const spawnMock = mock((_cmd: string, _args: string[], _options: Record<string, unknown>) => {
  const child = { unref: mock(() => {}) };
  spawnedChildren.push(child);
  return child;
});

mock.module('child_process', () => ({
  spawn: spawnMock,
}));

import { scheduleWorkerRestart } from '../../src/services/worker/http/routes/SettingsRoutes.js';

describe('SettingsRoutes worker restart scheduling', () => {
  const originalArgv = [...process.argv];

  beforeEach(() => {
    spawnMock.mockClear();
    spawnedChildren.length = 0;
    process.argv[1] = '/tmp/worker-service.cjs';
  });

  afterEach(() => {
    process.argv.splice(0, process.argv.length, ...originalArgv);
  });

  it('restarts through the worker-service CLI instead of relying on process exit supervision', async () => {
    scheduleWorkerRestart('branch switch', 0);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0][0]).toBe(process.execPath);
    expect(spawnMock.mock.calls[0][1]).toEqual(['/tmp/worker-service.cjs', 'restart']);
    expect(spawnMock.mock.calls[0][2]).toMatchObject({
      detached: true,
      stdio: 'ignore',
    });
    expect((spawnMock.mock.calls[0][2] as any).env.CLAUDE_MEM_MANAGED).toBe('true');
    expect(spawnedChildren[0].unref).toHaveBeenCalledTimes(1);
  });
});
