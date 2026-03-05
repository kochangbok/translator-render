import { parseJsonWithRepair } from '@/shared/json';

describe('parseJsonWithRepair', () => {
  it('parses valid json', () => {
    const parsed = parseJsonWithRepair<{ ok: boolean }>('{"ok":true}');
    expect(parsed.ok).toBe(true);
  });

  it('repairs wrapped json', () => {
    const parsed = parseJsonWithRepair<{ data: number }>('```json\n{"data":1}\n```');
    expect(parsed.data).toBe(1);
  });
});
