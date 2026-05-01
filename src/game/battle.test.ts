import { describe, expect, it } from 'vitest';
import {
  applyBattleTick,
  applyTypingReward,
  createInitialRun,
  chooseUpgrade,
  startNextBattle,
} from './battle';
import type { Upgrade } from './types';

describe('battle loop', () => {
  it('turns completed prompts, accuracy, and combo into AI XP and task progress', () => {
    const run = createInitialRun();

    const next = applyTypingReward(run, {
      totalTyped: 24,
      correctChars: 24,
      errors: 0,
      accuracy: 100,
      combo: 24,
      elapsedMs: 1000,
    });

    expect(next.ai.xp).toBeGreaterThan(run.ai.xp);
    expect(next.battle.taskProgress).toBeGreaterThan(run.battle.taskProgress);
    expect(next.battle.log[0]).toContain('XP');
  });

  it('extends the battle deadline for high-accuracy prompt completions', () => {
    const run = createInitialRun();

    const next = applyTypingReward(run, {
      totalTyped: 24,
      correctChars: 24,
      errors: 0,
      accuracy: 100,
      combo: 24,
      elapsedMs: 1000,
    });

    expect(next.battle.opponent.deadlineMs).toBeGreaterThan(run.battle.opponent.deadlineMs);
    expect(next.battle.log[0]).toContain('시간 +');
  });

  it('does not extend time for low-accuracy prompt completions', () => {
    const run = createInitialRun();

    const next = applyTypingReward(run, {
      totalTyped: 24,
      correctChars: 16,
      errors: 8,
      accuracy: 66.67,
      combo: 0,
      elapsedMs: 1000,
    });

    expect(next.battle.opponent.deadlineMs).toBe(run.battle.opponent.deadlineMs);
    expect(next.battle.log[0]).not.toContain('시간 +');
  });

  it('levels the AI when XP crosses the current threshold', () => {
    const run = createInitialRun();
    const boosted = {
      ...run,
      ai: { ...run.ai, xp: run.ai.nextLevelXp - 1 },
    };

    const next = applyTypingReward(boosted, {
      totalTyped: 24,
      correctChars: 24,
      errors: 0,
      accuracy: 100,
      combo: 24,
      elapsedMs: 2000,
    });

    expect(next.ai.level).toBe(2);
    expect(next.ai.xp).toBeLessThan(next.ai.nextLevelXp);
    expect(next.ai.focus).toBeGreaterThan(boosted.ai.focus);
  });

  it('lets the opponent apply pressure over time without damaging HP', () => {
    const run = createInitialRun();
    const next = applyBattleTick(run, 15_000);

    expect(next.ai.focus).toBeLessThan(run.ai.focus);
    expect(next.battle.pressure).toBeGreaterThan(run.battle.pressure);
    expect(next.battle.taskProgress).toBeLessThanOrEqual(run.battle.taskProgress);
  });

  it('marks battle victory when task progress reaches 100 percent', () => {
    const run = {
      ...createInitialRun(),
      battle: { ...createInitialRun().battle, taskProgress: 99 },
    };

    const next = applyTypingReward(run, {
      totalTyped: 24,
      correctChars: 24,
      errors: 0,
      accuracy: 100,
      combo: 30,
      elapsedMs: 3000,
    });

    expect(next.battle.status).toBe('won');
    expect(next.runStatus).toBe('upgrade');
  });

  it('completes the run immediately when the final battle is won', () => {
    const base = createInitialRun();
    const finalBattle = {
      ...base,
      battleIndex: base.maxBattles - 1,
      battle: { ...base.battle, taskProgress: 99 },
    };

    const next = applyTypingReward(finalBattle, {
      totalTyped: 24,
      correctChars: 24,
      errors: 0,
      accuracy: 100,
      combo: 30,
      elapsedMs: 3000,
    });

    expect(next.battle.status).toBe('won');
    expect(next.runStatus).toBe('complete');
  });

  it('applies upgrades to later rewards', () => {
    const run = createInitialRun();
    const upgrade: Upgrade = {
      id: 'xp-drip',
      name: '과잉 칭찬',
      description: 'XP gain up',
      stat: 'xpMultiplier',
      amount: 0.25,
    };

    const upgraded = chooseUpgrade(run, upgrade);

    expect(upgraded.ai.xpMultiplier).toBeCloseTo(1.25);
    expect(upgraded.upgrades).toContainEqual(upgrade);
  });

  it('starts the next battle after an upgrade and completes the run after the final battle', () => {
    const firstWin = {
      ...createInitialRun(),
      runStatus: 'upgrade' as const,
      battle: { ...createInitialRun().battle, status: 'won' as const, taskProgress: 100 },
    };

    const second = startNextBattle(firstWin);

    expect(second.runStatus).toBe('battle');
    expect(second.battleIndex).toBe(1);
    expect(second.battle.taskProgress).toBe(0);
    expect(second.battle.opponent.name).not.toBe(firstWin.battle.opponent.name);

    const finalWin = {
      ...second,
      battleIndex: second.maxBattles - 1,
      runStatus: 'upgrade' as const,
      battle: { ...second.battle, status: 'won' as const, taskProgress: 100 },
    };

    expect(startNextBattle(finalWin).runStatus).toBe('complete');
  });
});
