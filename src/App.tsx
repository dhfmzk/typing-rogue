import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyBattleTick,
  applyTypingReward,
  chooseUpgrade,
  createInitialRun,
  startNextBattle,
} from './game/battle';
import { PROMPTS, UPGRADE_POOL } from './game/content';
import { calculateWpm, commitTypingText, evaluateTypedText, getNextPromptIndex } from './game/typing';
import type { RunState, Upgrade, UpgradeStat } from './game/types';
import './styles.css';

type StrikeFeedback = 'idle' | 'hit' | 'miss';

const TRAINING_BURST_MS = 860;

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getUpgradeChoices(run: RunState): Upgrade[] {
  const start = run.battleIndex % UPGRADE_POOL.length;
  return [UPGRADE_POOL[start], UPGRADE_POOL[(start + 1) % UPGRADE_POOL.length]];
}

function getLogTone(entry: string): string {
  if (entry.includes('압박')) {
    return 'danger';
  }

  if (entry.includes('XP') || entry.includes('과제')) {
    return 'gain';
  }

  return 'plain';
}

function getThreatClass(name: string): string {
  if (name.includes('마감')) {
    return 'deadline';
  }

  if (name.includes('컨텍스트')) {
    return 'overload';
  }

  return 'fog';
}

function getAiPowerTier(level: number): string {
  if (level >= 5) {
    return 'overclock';
  }

  if (level >= 3) {
    return 'charged';
  }

  return 'newbie';
}

function getAiStageLabel(level: number): string {
  if (level >= 5) {
    return '폭주 모델';
  }

  if (level >= 3) {
    return '각성 모델';
  }

  return '응애 모델';
}

function getAiSpriteSrc(level: number): string {
  if (level >= 5) {
    return '/assets/ai-companion-overclock.png';
  }

  if (level >= 3) {
    return '/assets/ai-companion-charged.png';
  }

  return '/assets/ai-companion-newbie.png';
}

function getUpgradeDelta(upgrade: Upgrade, run: RunState): string {
  if (upgrade.stat === 'xpMultiplier') {
    return `XP x${run.ai.xpMultiplier.toFixed(2)} -> x${(run.ai.xpMultiplier + upgrade.amount).toFixed(2)}`;
  }

  if (upgrade.stat === 'progressMultiplier') {
    return `완성도 x${run.ai.progressMultiplier.toFixed(2)} -> x${(run.ai.progressMultiplier + upgrade.amount).toFixed(2)}`;
  }

  if (upgrade.stat === 'errorForgiveness') {
    return `오타 완충 +${upgrade.amount.toFixed(1)}`;
  }

  return `집중도 +${Math.round(upgrade.amount)}`;
}

function getUpgradeClass(stat: UpgradeStat): string {
  return `upgrade-${stat}`;
}

export default function App() {
  const [run, setRun] = useState<RunState>(() => createInitialRun());
  const [promptIndex, setPromptIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [lastStrike, setLastStrike] = useState<StrikeFeedback>('idle');
  const [trainingBurstId, setTrainingBurstId] = useState(0);
  const [trainingBurstActive, setTrainingBurstActive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const evaluatedTypedRef = useRef('');
  const isComposingRef = useRef(false);

  const targetPrompt = PROMPTS[promptIndex];
  const typedChars = Array.from(typed);
  const targetChars = Array.from(targetPrompt);
  const evaluation = evaluateTypedText(targetPrompt, typed);
  const wpm = calculateWpm(run.typing);
  const accuracy = run.typing.totalTyped === 0 ? 100 : (run.typing.correctChars / run.typing.totalTyped) * 100;
  const upgradeChoices = useMemo(() => getUpgradeChoices(run), [run]);
  const aiPowerTier = getAiPowerTier(run.ai.level);
  const aiStageLabel = getAiStageLabel(run.ai.level);
  const aiSpriteSrc = getAiSpriteSrc(run.ai.level);

  useEffect(() => {
    if (run.runStatus !== 'battle' || run.battle.status !== 'active') {
      return;
    }

    const started = Date.now() - run.battle.elapsedMs;
    const timer = window.setInterval(() => {
      setRun((current) => applyBattleTick(current, Date.now() - started));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [run.battle.elapsedMs, run.battle.status, run.runStatus]);

  useEffect(() => {
    if (run.runStatus === 'battle') {
      inputRef.current?.focus();
    }
  }, [promptIndex, run.runStatus]);

  useEffect(() => {
    if (!trainingBurstActive) {
      return;
    }

    const timer = window.setTimeout(() => setTrainingBurstActive(false), TRAINING_BURST_MS);

    return () => window.clearTimeout(timer);
  }, [trainingBurstActive, trainingBurstId]);

  function triggerTrainingBurst() {
    setTrainingBurstId((current) => current + 1);
    setTrainingBurstActive(true);
  }

  function restart() {
    setRun(createInitialRun());
    setPromptIndex(0);
    setTyped('');
    setInputValue('');
    evaluatedTypedRef.current = '';
    isComposingRef.current = false;
    setLastStrike('idle');
    setTrainingBurstActive(false);
    setTrainingBurstId(0);
  }

  function handleInputChange(value: string, options: { composing?: boolean } = {}) {
    if (run.runStatus !== 'battle' || run.battle.status !== 'active') {
      return;
    }

    setInputValue(value);

    if (options.composing) {
      setTyped(value);
      setLastStrike('idle');
      return;
    }

    const previousTyped = evaluatedTypedRef.current;
    const nextTyped = value;
    const nextTypedChars = Array.from(nextTyped);
    const previousLength = Array.from(previousTyped).length;

    setTyped(nextTyped);
    evaluatedTypedRef.current = nextTyped;

    if (nextTypedChars.length <= previousLength) {
      setLastStrike('idle');
      return;
    }

    const lastInputIndex = nextTypedChars.length - 1;
    setLastStrike(nextTypedChars[lastInputIndex] === targetChars[lastInputIndex] ? 'hit' : 'miss');

    const completedEvaluation = evaluateTypedText(targetPrompt, nextTyped);

    if (!completedEvaluation.isComplete) {
      return;
    }

    triggerTrainingBurst();

    setRun((current) => {
      const elapsedMs = Math.max(1000, current.typing.elapsedMs + completedEvaluation.totalTyped * 900);
      const nextStats = commitTypingText(current.typing, targetPrompt, nextTyped, elapsedMs);

      return applyTypingReward(
        {
          ...current,
          typing: nextStats,
        },
        {
          totalTyped: completedEvaluation.totalTyped,
          correctChars: completedEvaluation.correctChars,
          errors: completedEvaluation.errors,
          accuracy: completedEvaluation.accuracy,
          combo: nextStats.currentCombo,
          elapsedMs,
        },
      );
    });

    setPromptIndex((current) => getNextPromptIndex(current, PROMPTS.length));
    setTyped('');
    setInputValue('');
    evaluatedTypedRef.current = '';
    setLastStrike('idle');
  }

  function handleCompositionStart() {
    isComposingRef.current = true;
  }

  function handleCompositionEnd(value: string) {
    isComposingRef.current = false;
    handleInputChange(value);
  }

  function handleUpgrade(upgrade: Upgrade) {
    setRun((current) => startNextBattle(chooseUpgrade(current, upgrade)));
    setTyped('');
    setInputValue('');
    evaluatedTypedRef.current = '';
    isComposingRef.current = false;
    setPromptIndex((current) => getNextPromptIndex(current, PROMPTS.length));
    setLastStrike('idle');
    setTrainingBurstActive(false);
  }

  const battleComplete = run.runStatus === 'upgrade';
  const runComplete = run.runStatus === 'complete';
  const runLost = run.runStatus === 'lost';

  return (
    <main className={`game-root strike-${lastStrike} ${trainingBurstActive ? 'training-burst' : ''}`} data-testid="game-frame">
      <section className="game-canvas" aria-label="Typing Rogue game screen">
        <header className="game-hud" aria-label="런 컨트롤">
          <p>RUN {String(run.battleIndex + 1).padStart(2, '0')}</p>
          <button className="reset-button" type="button" onClick={restart} aria-label="새 런 시작">
            RESET
          </button>
        </header>

        <section className="battle-arena" data-testid="battle-arena" aria-label="전투 상황">
          <div className="task-hud">
            <span>
              전투 {run.battleIndex + 1}/{run.maxBattles}
            </span>
            <strong>{run.battle.taskName}</strong>
            <div className="task-bar" aria-label="과제 완성도">
              <i style={{ width: `${run.battle.taskProgress}%` }} />
            </div>
            <em data-testid="task-progress">{formatPercent(run.battle.taskProgress)}</em>
          </div>

          <div className="player-status companion-status" data-testid="companion-status">
            <strong>{run.ai.name}</strong>
            <span>LV {run.ai.level}</span>
            <span>FOCUS {formatPercent(run.ai.focus)}</span>
            <span>XP {Math.floor(run.ai.xp)}/{run.ai.nextLevelXp}</span>
          </div>

          <div
            className={`sprite companion-sprite ai-${aiPowerTier}`}
            data-testid="companion-sprite"
            data-stage={aiStageLabel}
            aria-hidden="true"
          >
            <span className="ai-stage-badge">{aiStageLabel}</span>
            <span className="ai-power-ring ring-one" />
            <span className="ai-power-ring ring-two" />
            <img src={aiSpriteSrc} alt="" />
          </div>

          {trainingBurstActive && (
            <div className="training-strike" data-testid="training-strike" key={trainingBurstId} aria-hidden="true">
              <span>프롬프트 채찍</span>
              <i className="lash-one" />
              <i className="lash-two" />
              <i className="lash-three" />
            </div>
          )}

          <div className={`enemy-nameplate threat-${getThreatClass(run.battle.opponent.name)}`}>
            <span>상대</span>
            <strong>{run.battle.opponent.name}</strong>
            <small>{run.battle.opponent.title}</small>
          </div>

          <ol className="battle-log" role="log" aria-live="polite" aria-label="전투 로그">
            {run.battle.log.length === 0 ? (
              <li className="log-plain">AI가 명령을 기다린다.</li>
            ) : (
              run.battle.log.slice(0, 4).map((entry, index) => (
                <li className={`log-${getLogTone(entry)}`} key={`${entry}-${index}`}>
                  {entry}
                </li>
              ))
            )}
          </ol>

          <dl className="typing-stats floating-stats" data-testid="typing-stats">
            <div>
              <dt>WPM</dt>
              <dd>{wpm}</dd>
            </div>
            <div>
              <dt>정확도</dt>
              <dd>{formatPercent(accuracy)}</dd>
            </div>
            <div>
              <dt>콤보</dt>
              <dd data-testid="combo">{run.typing.currentCombo}</dd>
            </div>
            <div>
              <dt>오타</dt>
              <dd data-testid="errors">{run.typing.errors}</dd>
            </div>
            <div>
              <dt>완료</dt>
              <dd>{run.typing.completedPrompts}</dd>
            </div>
          </dl>

          <section
            className="typing-display soul-box"
            data-testid="soul-box"
            aria-label="타자 연습"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="soul-marker" aria-hidden="true">
              <span />
            </div>
            <div className="typing-panel" data-testid="typing-display">
              <div className="typing-text" data-testid="target-prompt">
                {targetChars.map((char, index) => {
                  const typedChar = typedChars[index];
                  const displayChar = typedChar ?? char;
                  const state = typedChar === undefined ? 'pending' : typedChar === char ? 'correct' : 'error';
                  const showCaret = typedChars.length > 0 && index === typedChars.length;

                  return (
                    <Fragment key={`${char}-${index}`}>
                      {showCaret && <span className="typing-caret" aria-hidden="true" />}
                      <span className={`prompt-char ${state}`}>{displayChar}</span>
                    </Fragment>
                  );
                })}
                {typedChars.length >= targetChars.length && typedChars.length > 0 && <span className="typing-caret" aria-hidden="true" />}
              </div>
            </div>

            <textarea
              ref={inputRef}
              className="typing-capture"
              aria-label="타이핑 입력"
              value={inputValue}
              onChange={(event) => {
                const nativeEvent = event.nativeEvent as InputEvent;
                handleInputChange(event.target.value, { composing: isComposingRef.current || nativeEvent.isComposing });
              }}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={(event) => handleCompositionEnd(event.currentTarget.value)}
              disabled={battleComplete || runComplete || runLost}
              rows={3}
            />
          </section>
        </section>
      </section>

      {battleComplete && (
        <section className="game-modal" aria-label="업그레이드 선택">
          <div className="choice-box">
            <p>Battle cleared</p>
            <h2>AI 강화 선택</h2>
            <div className="upgrade-grid">
              {upgradeChoices.map((upgrade) => (
                <button
                  key={upgrade.id}
                  type="button"
                  className={`upgrade-card ${getUpgradeClass(upgrade.stat)}`}
                  onClick={() => handleUpgrade(upgrade)}
                >
                  <span>{getUpgradeDelta(upgrade, run)}</span>
                  <strong>{upgrade.name}</strong>
                  <small>{upgrade.description}</small>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {(runComplete || runLost) && (
        <section className="game-modal result-modal" aria-label="런 결과">
          <div className="choice-box">
            <p>{runComplete ? 'Run complete' : 'Run failed'}</p>
            <h2>{runComplete ? '최종 프롬프트가 살아났다.' : '프롬프트 터짐.'}</h2>
            <button className="upgrade-card single" type="button" onClick={restart}>
              다시 학습하기
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
