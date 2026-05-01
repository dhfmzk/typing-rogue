import type { RunState, TypingRewardInput, Upgrade } from './types';

const MAX_FOCUS = 100;
const MAX_PROGRESS = 100;
const LOG_LIMIT = 6;

const BATTLE_TEMPLATES = [
  {
    id: 1,
    taskName: '프롬프트 초안 작성',
    opponent: {
      name: '모호함',
      title: '요구사항 흐림',
      pressureRate: 1,
      focusDamage: 2,
      deadlineMs: 120_000,
    },
  },
  {
    id: 2,
    taskName: '문서 구조 정리',
    opponent: {
      name: '마감 압박',
      title: '시간 절약 강박',
      pressureRate: 1.4,
      focusDamage: 2.4,
      deadlineMs: 110_000,
    },
  },
  {
    id: 3,
    taskName: '최종 지시문 다듬기',
    opponent: {
      name: '컨텍스트 과부하',
      title: '정보량 폭주',
      pressureRate: 1.8,
      focusDamage: 2.8,
      deadlineMs: 100_000,
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function addLog(run: RunState, message: string): string[] {
  return [message, ...run.battle.log].slice(0, LOG_LIMIT);
}

function getCompletionTimeBonusMs(input: TypingRewardInput): number {
  if (input.accuracy >= 100) {
    return 7_000;
  }

  if (input.accuracy >= 95) {
    return 5_000;
  }

  if (input.accuracy >= 90) {
    return 3_000;
  }

  return 0;
}

function resolveLevel(ai: RunState['ai']): RunState['ai'] {
  let level = ai.level;
  let xp = ai.xp;
  let nextLevelXp = ai.nextLevelXp;
  let focus = ai.focus;

  while (xp >= nextLevelXp) {
    xp -= nextLevelXp;
    level += 1;
    nextLevelXp = Math.round(nextLevelXp * 1.35 + 20);
    focus = clamp(focus + 8, 0, MAX_FOCUS);
  }

  return {
    ...ai,
    level,
    xp,
    nextLevelXp,
    focus,
  };
}

export function createInitialRun(): RunState {
  const firstBattle = BATTLE_TEMPLATES[0];

  return {
    runStatus: 'battle',
    battleIndex: 0,
    maxBattles: 3,
    ai: {
      name: '모델-0',
      level: 1,
      xp: 0,
      nextLevelXp: 100,
      focus: 70,
      xpMultiplier: 1,
      progressMultiplier: 1,
      errorForgiveness: 0,
    },
    battle: {
      id: firstBattle.id,
      status: 'active',
      taskName: firstBattle.taskName,
      taskProgress: 0,
      pressure: 0,
      elapsedMs: 0,
      log: [],
      opponent: firstBattle.opponent,
    },
    typing: {
      startedAt: 0,
      elapsedMs: 0,
      totalTyped: 0,
      correctChars: 0,
      errors: 0,
      currentCombo: 0,
      bestCombo: 0,
      completedPrompts: 0,
    },
    upgrades: [],
  };
}

export function applyTypingReward(run: RunState, _input: TypingRewardInput): RunState {
  if (run.battle.status !== 'active') {
    return run;
  }

  const accuracyMultiplier = clamp(_input.accuracy / 100, 0.25, 1);
  const comboMultiplier = 1 + Math.min(_input.combo, 80) * 0.0125;
  const typoPenalty = clamp(1 - Math.max(0, _input.errors - run.ai.errorForgiveness) * 0.08, 0.35, 1);
  const lengthWeight = Math.max(1, _input.correctChars);
  const xpGain = lengthWeight * 1.1 * accuracyMultiplier * comboMultiplier * typoPenalty * run.ai.xpMultiplier;
  const focusMultiplier = 0.75 + run.ai.focus / 200;
  const progressGain =
    (3.5 + lengthWeight * 0.11) *
    accuracyMultiplier *
    comboMultiplier *
    typoPenalty *
    focusMultiplier *
    run.ai.progressMultiplier;
  const timeBonusMs = getCompletionTimeBonusMs(_input);
  const ai = resolveLevel({
    ...run.ai,
    xp: run.ai.xp + xpGain,
  });
  const taskProgress = clamp(run.battle.taskProgress + progressGain, 0, MAX_PROGRESS);
  const won = taskProgress >= MAX_PROGRESS;
  const nextRunStatus = won ? (run.battleIndex + 1 >= run.maxBattles ? 'complete' : 'upgrade') : run.runStatus;
  const timeBonusLog = timeBonusMs > 0 ? ` / 시간 +${Math.round(timeBonusMs / 1000)}초` : '';

  return {
    ...run,
    runStatus: nextRunStatus,
    ai,
    battle: {
      ...run.battle,
      status: won ? 'won' : run.battle.status,
      taskProgress,
      elapsedMs: Math.max(run.battle.elapsedMs, _input.elapsedMs),
      opponent: {
        ...run.battle.opponent,
        deadlineMs: run.battle.opponent.deadlineMs + timeBonusMs,
      },
      log: addLog(run, `문장 완료 +${xpGain.toFixed(1)} XP / 과제 +${progressGain.toFixed(1)}%${timeBonusLog}`),
    },
  };
}

export function applyBattleTick(run: RunState, elapsedMs: number): RunState {
  if (run.battle.status !== 'active') {
    return run;
  }

  const deltaMs = Math.max(0, elapsedMs - run.battle.elapsedMs);
  const pressureGain = (deltaMs / 1000) * run.battle.opponent.pressureRate;
  const focusLoss = (deltaMs / 10_000) * run.battle.opponent.focusDamage;
  const pressure = clamp(run.battle.pressure + pressureGain, 0, 100);
  const focus = clamp(run.ai.focus - focusLoss, 0, MAX_FOCUS);
  const lost = elapsedMs >= run.battle.opponent.deadlineMs || focus <= 0;

  return {
    ...run,
    runStatus: lost ? 'lost' : run.runStatus,
    ai: {
      ...run.ai,
      focus,
    },
    battle: {
      ...run.battle,
      status: lost ? 'lost' : run.battle.status,
      elapsedMs,
      pressure,
      log:
        pressureGain > 0
          ? addLog(run, `${run.battle.opponent.name} 압박 +${pressureGain.toFixed(1)}`)
          : run.battle.log,
    },
  };
}

export function chooseUpgrade(run: RunState, upgrade: Upgrade): RunState {
  const ai = { ...run.ai };

  if (upgrade.stat === 'focus') {
    ai.focus = clamp(ai.focus + upgrade.amount, 0, MAX_FOCUS);
  } else {
    ai[upgrade.stat] += upgrade.amount;
  }

  return {
    ...run,
    runStatus: 'battle',
    ai,
    upgrades: [...run.upgrades, upgrade],
  };
}

export function startNextBattle(run: RunState): RunState {
  const nextBattleIndex = run.battleIndex + 1;

  if (nextBattleIndex >= run.maxBattles) {
    return {
      ...run,
      runStatus: 'complete',
    };
  }

  const template = BATTLE_TEMPLATES[nextBattleIndex] ?? BATTLE_TEMPLATES[0];

  return {
    ...run,
    runStatus: 'battle',
    battleIndex: nextBattleIndex,
    battle: {
      id: template.id,
      status: 'active',
      taskName: template.taskName,
      taskProgress: 0,
      pressure: 0,
      elapsedMs: 0,
      log: [`전투 ${nextBattleIndex + 1}: ${template.opponent.name} 등장`],
      opponent: template.opponent,
    },
  };
}
