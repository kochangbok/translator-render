import { buildBlockCacheKey, hashString } from '@/shared/hash';

describe('hash utils', () => {
  it('returns deterministic hash', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
  });

  it('changes when input changes', () => {
    expect(hashString('abc')).not.toBe(hashString('abcd'));
  });

  it('builds cache key from all inputs', () => {
    const a = buildBlockCacheKey('u1', 'id1', 'hello');
    const b = buildBlockCacheKey('u1', 'id1', 'hello2');
    expect(a).not.toBe(b);
  });
});
