import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => {
  vi.useRealTimers();
});

describe('Typing Rogue UI', () => {
  it('renders the tactical battle panel and typing practice panel', () => {
    render(<App />);

    expect(screen.getByTestId('game-frame')).toBeInTheDocument();
    expect(screen.getByTestId('battle-arena')).toBeInTheDocument();
    expect(screen.getByTestId('typing-display')).toBeInTheDocument();
    expect(screen.getByTestId('soul-box')).toBeInTheDocument();
    expect(screen.getByTestId('companion-status')).toBeInTheDocument();
    expect(screen.getByTestId('companion-sprite')).toBeInTheDocument();
    expect(screen.getByTestId('typing-stats')).toBeInTheDocument();
    expect(screen.queryByText('Typing Rogue')).not.toBeInTheDocument();
    expect(screen.getByText('모델-0')).toBeInTheDocument();
    expect(screen.getByText(/상대/)).toBeInTheDocument();
    expect(screen.getByLabelText('타이핑 입력')).toBeInTheDocument();
    expect(screen.getByText('WPM')).toBeInTheDocument();
    expect(screen.getByText('정확도')).toBeInTheDocument();
  });

  it('does not light up a prompt character before typing starts', () => {
    render(<App />);

    const prompt = screen.getByTestId('target-prompt');

    expect(prompt.querySelectorAll('.prompt-char.current')).toHaveLength(0);
    expect(prompt.querySelectorAll('.prompt-char.correct')).toHaveLength(0);
    expect(prompt.querySelectorAll('.prompt-char.error')).toHaveLength(0);
  });

  it('only marks typed characters as lit after a partial input', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');
    const prompt = screen.getByTestId('target-prompt');

    fireEvent.change(input, { target: { value: 'A' } });

    expect(prompt.querySelectorAll('.prompt-char.correct')).toHaveLength(1);
    expect(prompt.querySelectorAll('.prompt-char.current')).toHaveLength(0);
    expect(screen.getByTestId('combo')).toHaveTextContent('0');
    expect(screen.getByTestId('task-progress')).toHaveTextContent('0%');
  });

  it('compares the actual typed string without keyboard-layout conversion', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');
    const prompt = screen.getByTestId('target-prompt');

    fireEvent.change(input, { target: { value: 'ㅁ' } });

    expect(input).toHaveValue('ㅁ');
    expect(prompt.querySelectorAll('.prompt-char.correct')).toHaveLength(0);
    expect(prompt.querySelector('.prompt-char.error')).toHaveTextContent('ㅁ');
    expect(screen.getByTestId('combo')).toHaveTextContent('0');
    expect(screen.getByTestId('errors')).toHaveTextContent('0');
  });

  it('commits stats and task progress only when a full prompt is submitted', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');
    const firstPrompt = screen.getByTestId('target-prompt').textContent ?? '';

    fireEvent.change(input, { target: { value: firstPrompt.slice(0, 4) } });

    expect(input).toHaveValue(firstPrompt.slice(0, 4));
    expect(screen.getByTestId('task-progress')).toHaveTextContent('0%');
    expect(screen.getByTestId('combo')).toHaveTextContent('0');

    const submittedPrompt = `${firstPrompt.slice(0, 4)}x${firstPrompt.slice(5)}`;
    fireEvent.change(input, { target: { value: submittedPrompt } });

    expect(input).toHaveValue('');
    expect(screen.getByTestId('task-progress')).not.toHaveTextContent('0%');
    expect(screen.getByTestId('errors')).toHaveTextContent('1');
  });

  it('rewards high-accuracy prompt completion with extra time', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');
    const firstPrompt = screen.getByTestId('target-prompt').textContent ?? '';

    fireEvent.change(input, { target: { value: firstPrompt } });

    expect(screen.getByRole('log')).toHaveTextContent('시간 +');
    expect(screen.getByTestId('combo')).not.toHaveTextContent('0');
  });

  it('shows a training strike when a prompt is completed', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');
    const firstPrompt = screen.getByTestId('target-prompt').textContent ?? '';

    expect(screen.queryByTestId('training-strike')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: firstPrompt } });

    expect(screen.getByTestId('training-strike')).toBeInTheDocument();
    expect(screen.getByTestId('training-strike')).toHaveTextContent('프롬프트 채찍');
  });

  it('changes the AI visual tier as it levels up', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');
    const companion = screen.getByTestId('companion-sprite');
    const sprite = companion.querySelector('img');

    expect(companion).toHaveClass('ai-newbie');
    expect(companion).toHaveAttribute('data-stage', '응애 모델');
    expect(sprite?.getAttribute('src')).toContain('assets/ai-companion-newbie.png');

    for (let index = 0; index < 4; index += 1) {
      const prompt = screen.getByTestId('target-prompt').textContent ?? '';
      fireEvent.change(input, { target: { value: prompt } });
    }

    expect(companion).toHaveClass('ai-charged');
    expect(companion).toHaveAttribute('data-stage', '각성 모델');
    expect(sprite?.getAttribute('src')).toContain('assets/ai-companion-charged.png');
  });

  it('does not convert typed English key sequences into Korean syllables', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');

    fireEvent.change(input, { target: { value: 'AIdprp' } });

    expect(input).toHaveValue('AIdprp');
    expect(screen.getByTestId('target-prompt')).toHaveTextContent('AIdprp');
    expect(screen.getByTestId('target-prompt').querySelector('.prompt-char.error')).toHaveTextContent('d');
    expect(screen.getByTestId('combo')).toHaveTextContent('0');
    expect(screen.getByTestId('errors')).toHaveTextContent('0');
  });

  it('waits for Korean IME composition before scoring characters', () => {
    render(<App />);

    const input = screen.getByLabelText('타이핑 입력');

    fireEvent.change(input, { target: { value: 'AI' } });
    expect(screen.getByTestId('combo')).toHaveTextContent('0');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'AIㅇ' } });

    expect(input).toHaveValue('AIㅇ');
    expect(screen.getByTestId('combo')).toHaveTextContent('0');
    expect(screen.getByTestId('errors')).toHaveTextContent('0');

    fireEvent.compositionEnd(input, { target: { value: 'AI에' } });

    expect(screen.getByTestId('combo')).toHaveTextContent('0');
    expect(screen.getByTestId('errors')).toHaveTextContent('0');
  });

  it('uses concise game-over copy when the run fails', () => {
    vi.useFakeTimers();
    render(<App />);

    act(() => {
      vi.advanceTimersByTime(121_000);
    });

    expect(screen.getByText('프롬프트 터짐.')).toBeInTheDocument();
    expect(screen.queryByText('압박이 AI 집중도를 무너뜨렸다.')).not.toBeInTheDocument();
    expect(screen.queryByText('초안이 산으로 갔다.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 학습하기' })).toBeInTheDocument();
  });
});
