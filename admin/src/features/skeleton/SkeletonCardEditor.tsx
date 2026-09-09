import React, { useState } from 'react';
import styled from 'styled-components';

import type { CardPatch, QuestionPatch } from '@admin/api/types';
import {
  BodyArea,
  SmallButton,
  TitleInput,
} from '@admin/features/editor/fields';
import type { SkeletonRenderCard } from '@admin/model/skeletonCards';
import { admin } from '@admin/styles/theme';

// One card, open for editing.
//
// The form says out loud who it is about to change, because that is the whole
// distinction this step draws: a shared card is everybody's, and a yellow one
// belongs to a single state. Saving the wrong one used to be possible and
// silent; here it is a sentence above the buttons.

const STATE_BORDER = 'rgba(217,119,6,.55)';

type Props = {
  card: SkeletonRenderCard;
  // Present when this card belongs to one state: its notes, or its own lesson.
  stateCode?: string;
  saving: boolean;
  refusal: string[] | null;
  onSave: (patch: CardPatch) => void;
  onSaveQuestion: (patch: QuestionPatch) => void;
  onCancel: () => void;
};

const SkeletonCardEditor: React.FC<Props> = ({
  card,
  stateCode,
  saving,
  refusal,
  onSave,
  onSaveQuestion,
  onCancel,
}) => {
  const isRecall = card.type === 'check_yourself';
  const isQuestion =
    card.type === 'lesson_test' || card.type === 'quick_challenge';
  const [title, setTitle] = useState(card.title);
  // A recall card is a context line and the rule with its [[gaps]]; every other
  // teaching card is a title and its paragraphs.
  const [lines, setLines] = useState<string[]>(card.bodies);
  const [choices, setChoices] = useState<string[]>(
    (card.options ?? []).map(option => option.text),
  );
  const [correct, setCorrect] = useState(
    Math.max(
      0,
      (card.options ?? []).findIndex(option => option.correct),
    ),
  );

  const setLine = (index: number, value: string) =>
    setLines(current => current.map((line, i) => (i === index ? value : line)));

  const save = () => {
    if (isQuestion) {
      onSaveQuestion({
        prompt: title,
        ...(choices.length > 0 && { choices, correct }),
        explanation: lines[lines.length - 1] ?? '',
      });
      return;
    }
    if (isRecall) {
      onSave({ context: lines[0] ?? '', ruleMarkdown: lines[1] ?? '' });
      return;
    }
    // Bullets were flattened into the body list with a marker; they go back
    // the way they came so a card keeps its shape.
    const bullets = lines
      .filter(line => line.startsWith('• '))
      .map(line => line.slice(2));
    onSave({
      title,
      lines: lines.filter(line => !line.startsWith('• ')),
      bullets: bullets.length > 0 ? bullets : null,
    });
  };

  return (
    <Form $state={stateCode != null} data-skeleton-editor={card.key}>
      <Scope $state={stateCode != null}>
        {stateCode == null
          ? 'Shared — saving changes this card in every state'
          : `${stateCode} only — saving changes ${stateCode} and no other state`}
      </Scope>

      {!isRecall && (
        <TitleInput
          value={title}
          aria-label="Card title"
          onChange={event => setTitle(event.target.value)}
        />
      )}

      {lines.map((line, index) => (
        <BodyArea
          key={index}
          rows={Math.max(2, Math.ceil(line.length / 70))}
          value={line}
          aria-label={`Line ${index + 1}`}
          onChange={event => setLine(index, event.target.value)}
        />
      ))}

      {choices.length > 0 && (
        <Choices>
          {choices.map((choice, index) => (
            <Choice key={index}>
              <input
                type="radio"
                checked={index === correct}
                aria-label={`Answer ${index + 1} is correct`}
                onChange={() => setCorrect(index)}
              />
              <ChoiceInput
                value={choice}
                aria-label={`Choice ${index + 1}`}
                onChange={event =>
                  setChoices(current =>
                    current.map((item, i) =>
                      i === index ? event.target.value : item,
                    ),
                  )
                }
              />
            </Choice>
          ))}
        </Choices>
      )}

      {refusal != null && (
        <Refusal>
          {refusal.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </Refusal>
      )}

      <Actions>
        <SmallButton onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </SmallButton>
        <SmallButton onClick={onCancel} disabled={saving}>
          Cancel
        </SmallButton>
      </Actions>
    </Form>
  );
};

export default SkeletonCardEditor;

const Form = styled.div<{ $state: boolean }>`
  background: ${admin.surface};
  border: 1px solid ${({ $state }) => ($state ? STATE_BORDER : admin.accent)};
  border-radius: 14px;
  padding: 15px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Scope = styled.p<{ $state: boolean }>`
  margin: 0 0 2px;
  font: 700 10px ${admin.mono};
  letter-spacing: 0.2px;
  color: ${({ $state }) => ($state ? '#B45309' : '#0369A1')};
`;

const Choices = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
`;

const Choice = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ChoiceInput = styled.input`
  flex: 1;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${admin.body};
  border: 1px solid ${admin.line3};
  border-radius: 8px;
  padding: 6px 9px;
  background: ${admin.surface};
`;

const Refusal = styled.ul`
  margin: 4px 0 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.6;
  color: #b91c1c;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
`;
