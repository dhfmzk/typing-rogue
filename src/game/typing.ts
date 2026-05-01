import type { TypingEvaluation, TypingStats } from './types';

function toChars(value: string): string[] {
  return Array.from(value);
}

export function evaluateTypedText(target: string, typed: string): TypingEvaluation {
  const targetChars = toChars(target);
  const typedChars = toChars(typed);
  const totalTyped = typedChars.length;
  const correctChars = typedChars.reduce((count, char, index) => {
    return count + (char === targetChars[index] ? 1 : 0);
  }, 0);
  const errors = totalTyped - correctChars;
  const accuracy = totalTyped === 0 ? 100 : (correctChars / totalTyped) * 100;

  return {
    totalTyped,
    correctChars,
    errors,
    accuracy,
    isComplete: totalTyped >= targetChars.length,
  };
}

export function commitTypingText(stats: TypingStats, target: string, typed: string, elapsedMs: number): TypingStats {
  const evaluation = evaluateTypedText(target, typed);
  const currentCombo = evaluation.errors === 0 ? stats.currentCombo + evaluation.totalTyped : 0;

  return {
    ...stats,
    elapsedMs,
    totalTyped: stats.totalTyped + evaluation.totalTyped,
    correctChars: stats.correctChars + evaluation.correctChars,
    errors: stats.errors + evaluation.errors,
    currentCombo,
    bestCombo: Math.max(stats.bestCombo, currentCombo),
    completedPrompts: stats.completedPrompts + (evaluation.isComplete ? 1 : 0),
  };
}

export function calculateWpm(stats: Pick<TypingStats, 'correctChars' | 'elapsedMs'>): number {
  if (stats.elapsedMs <= 0) {
    return 0;
  }

  const minutes = stats.elapsedMs / 60_000;
  return Math.round(stats.correctChars / 5 / minutes);
}

export function getNextPromptIndex(currentIndex: number, promptCount: number): number {
  if (promptCount <= 0) {
    return 0;
  }

  return (currentIndex + 1) % promptCount;
}
