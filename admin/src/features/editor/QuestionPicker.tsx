import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type { BankQuestion } from '@admin/api/types';
import type { CourseAssetV2 } from '@/data/course/v2/wire';
import { GhostButton, Spacer } from '@admin/features/shell/ui';
import { admin } from '@admin/styles/theme';

// Which question from the course pool a slide asks. Questions are the
// course's own entity — every lesson and every module test draws from one
// pool by id — so pointing a slide at a different one is a choice, not a
// rewrite. What it replaces stays in the pool for anything else to ask.

type Props = {
  courseId: string;
  draftId: string;
  // The lesson doing the asking, so its own questions sort to the top.
  lessonId: string | null;
  currentQuestionId: string;
  onClose: () => void;
  onPick: (question: BankQuestion, asset?: CourseAssetV2) => void;
};

const QuestionPicker: React.FC<Props> = ({
  courseId,
  draftId,
  lessonId,
  currentQuestionId,
  onClose,
  onPick,
}) => {
  const [pool, setPool] = useState<{
    questions: BankQuestion[];
    assets: CourseAssetV2[];
  } | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    void adminApi
      .questions(courseId, draftId)
      .then(response => {
        if (live) {
          setPool({
            questions: response.questions,
            assets: response.assets ?? [],
          });
        }
      })
      .catch(() => {
        if (live) {
          setPool({ questions: [], assets: [] });
        }
      });
    return () => {
      live = false;
    };
  }, [courseId, draftId]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = (pool?.questions ?? []).filter(
      question =>
        needle.length === 0 ||
        question.prompt.toLowerCase().includes(needle) ||
        question.questionId.toLowerCase().includes(needle),
    );
    // This lesson first, then the rest of the course, then whatever nothing
    // asks any more — the order an author looks in.
    const here = matching.filter(question => question.lessonId === lessonId);
    const elsewhere = matching.filter(
      question => question.lessonId != null && question.lessonId !== lessonId,
    );
    const unused = matching.filter(question => question.lessonId == null);
    return [
      ['This lesson', here] as const,
      ['Elsewhere in the course', elsewhere] as const,
      ['Asked by nothing', unused] as const,
    ].filter(([, list]) => list.length > 0);
  }, [pool, query, lessonId]);

  const assetOf = (question: BankQuestion): CourseAssetV2 | undefined =>
    question.assetId == null
      ? undefined
      : pool?.assets.find(asset => asset.assetId === question.assetId);

  return (
    <Backdrop onClick={onClose}>
      <Dialog onClick={event => event.stopPropagation()}>
        <Title>Ask a different question</Title>
        <Subtitle>
          Every question in this course, whatever asks it today. Picking one
          points this slide at it; the question it replaces stays in the pool.
        </Subtitle>

        <Search
          autoFocus
          value={query}
          placeholder="Search the pool"
          onChange={event => setQuery(event.target.value)}
        />

        <List>
          {pool == null ? (
            <Loading>loading the pool…</Loading>
          ) : groups.length === 0 ? (
            <Loading>nothing matches “{query}”</Loading>
          ) : (
            groups.map(([label, list]) => (
              <Group key={label}>
                <GroupTitle>
                  {label} · {list.length}
                </GroupTitle>
                {list.map(question => (
                  <Row
                    key={question.questionId}
                    $on={question.questionId === currentQuestionId}
                    title={
                      question.questionId === currentQuestionId
                        ? 'This slide already asks it'
                        : 'Ask this one instead'
                    }
                    onClick={() => {
                      if (question.questionId !== currentQuestionId) {
                        onPick(question, assetOf(question));
                      }
                      onClose();
                    }}
                  >
                    <RowText>
                      <Prompt>{question.prompt}</Prompt>
                      <Meta>
                        {question.questionId}
                        {question.assetId != null && ' · has a picture'}
                        {question.questionId === currentQuestionId &&
                          ' · asked here now'}
                      </Meta>
                    </RowText>
                  </Row>
                ))}
              </Group>
            ))
          )}
        </List>

        <Actions>
          <Spacer />
          <GhostButton onClick={onClose}>Cancel</GhostButton>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};

export default QuestionPicker;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(24, 24, 27, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

const Dialog = styled.div`
  width: 600px;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: ${admin.surface};
  border-radius: 16px;
  padding: 22px 24px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
`;

const Title = styled.h3`
  margin: 0 0 5px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const Subtitle = styled.p`
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.55;
  font-weight: 500;
  color: ${admin.dim};
  text-wrap: pretty;
`;

const Search = styled.input`
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: ${admin.body};
  padding: 8px 11px;
  margin-bottom: 10px;
  border: 1px solid ${admin.line3};
  border-radius: 9px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const List = styled.div`
  flex: 1;
  overflow: auto;
  border: 1px solid ${admin.line3};
  border-radius: 12px;
  padding: 8px;
`;

const Group = styled.div`
  margin-bottom: 10px;
`;

const GroupTitle = styled.span`
  display: block;
  font: 600 9.5px ${admin.mono};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${admin.dim2};
  padding: 4px 6px;
`;

const Row = styled.div<{ $on: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 8px;
  border-radius: 8px;
  cursor: ${({ $on }) => ($on ? 'default' : 'pointer')};
  background: ${({ $on }) => ($on ? admin.accentSoft : 'transparent')};

  &:hover {
    background: ${({ $on }) => ($on ? admin.accentSoft : admin.bg)};
  }
`;

const RowText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Prompt = styled.span`
  font-size: 12px;
  line-height: 1.45;
  font-weight: 600;
  color: ${admin.body};
`;

const Meta = styled.span`
  font: 500 9.5px ${admin.mono};
  color: ${admin.dim2};
`;

const Loading = styled.div`
  padding: 20px;
  text-align: center;
  font: 500 11px ${admin.mono};
  color: ${admin.dim2};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 16px;
`;
