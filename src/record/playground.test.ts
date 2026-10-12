import { describe, expect, it } from 'vitest';
import { diff } from './playground';

describe('diff', () => {
  it('finds a typed character', () => {
    expect(diff('abc', 'abXc')).toEqual([2, 0, 'X']);
  });
  it('finds a deletion', () => {
    expect(diff('hello world', 'hello')).toEqual([5, 6, '']);
  });
  it('finds a replacement', () => {
    expect(diff('return a', 'return b')).toEqual([7, 1, 'b']);
  });
  it('handles repeated characters without overlapping prefix and suffix', () => {
    expect(diff('aaa', 'aaaa')).toEqual([3, 0, 'a']);
    expect(diff('aaaa', 'aaa')).toEqual([3, 1, '']);
  });
  it('reports no edit for identical text', () => {
    expect(diff('same', 'same')).toEqual([4, 0, '']);
  });
});
