import { describe, expect, it } from 'vitest';
import { runAllChecks } from './smoke';

describe('解析与生成全链路', () => {
  const results = runAllChecks();

  it('所有检查通过', () => {
    const failed = results.filter((r) => !r.ok);
    expect(failed.map((f) => `${f.name}${f.detail ? ` — ${f.detail}` : ''}`)).toEqual([]);
  });

  it('覆盖了完整检查集', () => {
    expect(results.length).toBeGreaterThanOrEqual(70);
  });

  it('包含协议解析、双内核生成与 RouterOS 分组', () => {
    const names = results.map((r) => r.name).join('|');
    expect(names).toContain('SS 节点');
    expect(names).toContain('mihomo');
    expect(names).toContain('sing-box');
    expect(names).toContain('ROS');
  });
});
