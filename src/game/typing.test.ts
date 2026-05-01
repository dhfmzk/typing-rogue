import { describe, expect, it } from 'vitest';
import {
  calculateWpm,
  commitTypingText,
  evaluateTypedText,
  getNextPromptIndex,
} from './typing';
import type { TypingStats } from './types';

const baseStats: TypingStats = {
  startedAt: 0,
  elapsedMs: 0,
  totalTyped: 0,
  correctChars: 0,
  errors: 0,
  currentCombo: 0,
  bestCombo: 0,
  completedPrompts: 0,
};

describe('typing evaluation', () => {
  it('allows typo progress while tracking accuracy and incorrect characters', () => {
    const result = evaluateTypedText('AI에게 명확한 역할을 부여한다.', 'AI에게 명확한 역활을 부여한다.');

    expect(result.isComplete).toBe(true);
    expect(result.totalTyped).toBe(18);
    expect(result.errors).toBe(1);
    expect(result.accuracy).toBeCloseTo(94.44, 2);
  });

  it('commits totals once when a full prompt is completed', () => {
    const next = commitTypingText(baseStats, 'AI에게 명확한 역할을 부여한다.', 'AI에게 명확한 역활을 부여한다.', 4200);

    expect(next.totalTyped).toBe(18);
    expect(next.correctChars).toBe(17);
    expect(next.errors).toBe(1);
    expect(next.currentCombo).toBe(0);
    expect(next.bestCombo).toBe(0);
    expect(next.completedPrompts).toBe(1);
    expect(next.elapsedMs).toBe(4200);
  });

  it('keeps combo only for perfect prompt completions', () => {
    const next = commitTypingText(baseStats, 'AI에게 명확한 역할을 부여한다.', 'AI에게 명확한 역할을 부여한다.', 4200);

    expect(next.currentCombo).toBe(18);
    expect(next.bestCombo).toBe(18);
    expect(next.completedPrompts).toBe(1);
  });

  it('calculates WPM from standard five-character words', () => {
    expect(calculateWpm({ ...baseStats, correctChars: 50, elapsedMs: 60_000 })).toBe(10);
  });

  it('advances prompt index after a prompt is completed', () => {
    expect(getNextPromptIndex(2, 5)).toBe(3);
    expect(getNextPromptIndex(4, 5)).toBe(0);
  });
});
