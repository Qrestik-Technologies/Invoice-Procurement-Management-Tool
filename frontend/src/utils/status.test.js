import { describe, expect, it } from 'vitest';
import { toDisplayStatus, toApiStatus, canDispatch } from '../utils/status';

describe('status helpers', () => {
  it('maps API status to display label', () => {
    expect(toDisplayStatus('dispatched')).toBe('Dispatched');
    expect(toDisplayStatus('draft')).toBe('Draft');
  });

  it('maps display status to API value', () => {
    expect(toApiStatus('Received')).toBe('received');
  });

  it('checks dispatch permission', () => {
    expect(canDispatch('admin')).toBe(true);
    expect(canDispatch('readonly')).toBe(false);
  });
});
