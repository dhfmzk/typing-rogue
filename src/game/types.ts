export type BattleStatus = 'active' | 'won' | 'lost';
export type RunStatus = 'battle' | 'upgrade' | 'complete' | 'lost';

export interface TypingStats {
  startedAt: number;
  elapsedMs: number;
  totalTyped: number;
  correctChars: number;
  errors: number;
  currentCombo: number;
  bestCombo: number;
  completedPrompts: number;
}

export interface TypingEvaluation {
  totalTyped: number;
  correctChars: number;
  errors: number;
  accuracy: number;
  isComplete: boolean;
}

export interface TypingRewardInput {
  totalTyped: number;
  correctChars: number;
  errors: number;
  accuracy: number;
  combo: number;
  elapsedMs: number;
}

export interface AiCompanion {
  name: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  focus: number;
  xpMultiplier: number;
  progressMultiplier: number;
  errorForgiveness: number;
}

export interface Opponent {
  name: string;
  title: string;
  pressureRate: number;
  focusDamage: number;
  deadlineMs: number;
}

export interface BattleState {
  id: number;
  status: BattleStatus;
  taskName: string;
  taskProgress: number;
  pressure: number;
  elapsedMs: number;
  log: string[];
  opponent: Opponent;
}

export type UpgradeStat =
  | 'xpMultiplier'
  | 'progressMultiplier'
  | 'errorForgiveness'
  | 'focus';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  stat: UpgradeStat;
  amount: number;
}

export interface RunState {
  runStatus: RunStatus;
  battleIndex: number;
  maxBattles: number;
  ai: AiCompanion;
  battle: BattleState;
  typing: TypingStats;
  upgrades: Upgrade[];
}
