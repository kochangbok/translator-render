import { chunkArray } from '@/shared/chunk';

describe('chunkArray', () => {
  it('splits arrays by size', () => {
    const result = chunkArray([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns one chunk for invalid size', () => {
    const result = chunkArray([1, 2], 0);
    expect(result).toEqual([[1, 2]]);
  });
});
