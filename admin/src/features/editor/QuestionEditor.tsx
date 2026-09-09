import React from 'react';
import styled from 'styled-components';

import type { CourseQuestionV2 } from '@/data/course/v2/wire';
import type { BankAsset } from '@admin/api/types';
import { assetSrc } from '@admin/model/svg';
import { admin } from '@admin/styles/theme';

import { Spacer } from '@admin/features/shell/ui';

import {
  BodyArea,
  DashedButton,
  FieldLabel,
  SmallButton,
  SmallInput,
} from './fields';

// Everything a question carries. A quiz slide and a checkpoint card edit the
// same thing, so they edit it through the same component — including the
// explanation, which is the fallback the app shows when a choice has no
// feedback of its own.

type Props = {
  question: CourseQuestionV2;
  // Every picture the host holds, so a question's own illustration can be
  // drawn where it is edited. Read-only: a lesson's assets and a bank's
  // differ in what else they carry, and this needs neither.
  assets: ReadonlyMap<string, BankAsset>;
  // The whole edited question, every time. Controlled on purpose: the same
  // editor now serves a slide (whose questions live in the lesson working
  // copy) and the pool sheet (which saves one question on its own), and
  // neither has to know how the other stores what it holds.
  onQuestion: (question: CourseQuestionV2) => void;
  onAssetAlt?: (assetId: string, alt: string) => void;
  // Offered above the question — swapping which one this slide asks.
  action?: React.ReactNode;
  // The picture this question shows. The host owns the upload and where the
  // asset is kept, because a lesson document and the published bank keep it
  // in different places; the editor only says when the author asked.
  onPickPicture?: () => void;
  onRemovePicture?: () => void;
};

// The wire contract allows 3 to 5 choices per question.
const MAX_CHOICES = 5;
const MIN_CHOICES = 3;

const QuestionEditor: React.FC<Props> = ({
  question,
  assets,
  onQuestion,
  onAssetAlt,
  action,
  onPickPicture,
  onRemovePicture,
}) => {
  const patch = (next: Partial<CourseQuestionV2>) =>
    onQuestion({ ...question, ...next });
  const withChoices = (choices: CourseQuestionV2['choices']) =>
    onQuestion({
      ...question,
      choices,
      // Never leave a question without a correct answer.
      correctAnswerId: choices.some(
        choice => choice.id === question.correctAnswerId,
      )
        ? question.correctAnswerId
        : choices[0]?.id ?? question.correctAnswerId,
    });
  const editChoice = (choiceId: string, text: string) =>
    withChoices(
      question.choices.map(choice =>
        choice.id === choiceId ? { ...choice, text } : choice,
      ),
    );
  const editChoiceFeedback = (choiceId: string, feedback: string) =>
    withChoices(
      question.choices.map(choice =>
        choice.id === choiceId ? { ...choice, feedback } : choice,
      ),
    );
  const addChoice = () => {
    if (question.choices.length >= MAX_CHOICES) {
      return;
    }
    // Choice ids are the letters the app renders, so the next free one wins.
    const used = new Set(question.choices.map(choice => choice.id));
    const id =
      'ABCDE'.split('').find(letter => !used.has(letter)) ??
      `X${question.choices.length}`;
    withChoices([
      ...question.choices,
      { id, text: 'New answer option', feedback: '' },
    ]);
  };
  const removeChoice = (choiceId: string) =>
    withChoices(question.choices.filter(choice => choice.id !== choiceId));
  const asset =
    question.assetId == null ? undefined : assets.get(question.assetId);

  return (
    <Wrap>
      {/* A question's own illustration. It used to be drawn only in the
          read-only view, so a quiz slide lost its picture the moment an
          author opened the editor — the one place the picture matters most. */}
      {asset != null && (
        <ImageBox>
          <ImagePreview>
            <PreviewImage src={assetSrc(asset)} alt={asset.alt} />
          </ImagePreview>
          <ImageBar>
            <FieldLabel>QUESTION IMAGE</FieldLabel>
            <SmallInput
              value={asset.alt}
              placeholder="Describe the illustration"
              title="Shown to screen readers and in the diff"
              disabled={onAssetAlt == null}
              onChange={event =>
                onAssetAlt?.(asset.assetId, event.target.value)
              }
            />
            {onPickPicture != null && (
              <SmallButton
                title="Upload a different picture for this question"
                onClick={onPickPicture}
              >
                Replace
              </SmallButton>
            )}
            {onRemovePicture != null && (
              <SmallButton
                title="Ask this question without a picture"
                onClick={onRemovePicture}
              >
                Remove
              </SmallButton>
            )}
          </ImageBar>
        </ImageBox>
      )}

      {asset == null && question.assetId != null && (
        <MissingBox>
          <FieldLabel>QUESTION IMAGE</FieldLabel>
          <Missing>
            This question names {question.assetId}, which is not here to draw.
          </Missing>
          {onPickPicture != null && (
            <SmallButton title="Upload it" onClick={onPickPicture}>
              Upload
            </SmallButton>
          )}
        </MissingBox>
      )}

      {asset == null && question.assetId == null && onPickPicture != null && (
        <DashedButton
          title="Every question may show one picture"
          onClick={onPickPicture}
        >
          + Add a picture
        </DashedButton>
      )}

      <Field>
        <PromptHead>
          <FieldLabel>QUESTION</FieldLabel>
          <Spacer />
          <Id title="The id slides and module tests reference">
            {question.questionId}
          </Id>
          {action}
        </PromptHead>
        <BodyArea
          value={question.prompt}
          rows={2}
          placeholder="What the learner is asked"
          onChange={event => patch({ prompt: event.target.value })}
        />
      </Field>

      <Options>
        {question.choices.map(choice => (
          <OptionRow key={choice.id}>
            <Mark
              $correct={choice.id === question.correctAnswerId}
              title="Mark as the correct answer"
              onClick={() => patch({ correctAnswerId: choice.id })}
            />
            <OptionFields>
              <OptionInput
                value={choice.text}
                onChange={event => editChoice(choice.id, event.target.value)}
              />
              <SmallInput
                value={choice.feedback}
                placeholder="Feedback after picking this answer (required)"
                onChange={event =>
                  editChoiceFeedback(choice.id, event.target.value)
                }
              />
            </OptionFields>
            <SmallButton
              title="Remove option"
              disabled={question.choices.length <= MIN_CHOICES}
              onClick={() => removeChoice(choice.id)}
            >
              ✕
            </SmallButton>
          </OptionRow>
        ))}
        {question.choices.length < MAX_CHOICES && (
          <DashedButton onClick={addChoice}>+ Add answer option</DashedButton>
        )}
      </Options>

      <Field>
        <FieldLabel>EXPLANATION</FieldLabel>
        <BodyArea
          value={question.explanation}
          rows={2}
          placeholder="Shown when a choice carries no feedback of its own"
          onChange={event => patch({ explanation: event.target.value })}
        />
      </Field>
    </Wrap>
  );
};

export default QuestionEditor;

const MissingBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed ${admin.line2};
  border-radius: 10px;
`;

const Missing = styled.span`
  flex: 1;
  font-size: 11px;
  line-height: 1.45;
  font-weight: 600;
  color: #b45309;
`;

const PromptHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
`;

const Id = styled.span`
  font: 500 9.5px ${admin.mono};
  color: ${admin.dim2};
`;

const ImageBox = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${admin.line2};
  border-radius: 10px;
  overflow: hidden;
`;

const ImagePreview = styled.div`
  aspect-ratio: 16 / 9;
  background: ${admin.hair};
  display: flex;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const ImageBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid ${admin.hair};
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
`;

const OptionRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 11px;
  border: 1px solid ${admin.line3};
  border-radius: 10px;
`;

const OptionFields = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const Mark = styled.button<{ $correct: boolean }>`
  flex: none;
  width: 13px;
  height: 13px;
  margin-top: 3px;
  padding: 0;
  border-radius: 99px;
  cursor: pointer;
  border: ${({ $correct }) => ($correct ? 'none' : '1.5px solid #D4D4D8')};
  background: ${({ $correct }) => ($correct ? '#16A34A' : 'transparent')};

  &:hover {
    border-color: #16a34a;
  }
`;

const OptionInput = styled.input`
  flex: 1;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${admin.body};
  border: none;
  background: transparent;
  padding: 0;
  outline: none;

  &:focus {
    outline: 1.5px dashed rgba(4, 133, 247, 0.45);
    outline-offset: 3px;
    border-radius: 3px;
  }
`;
