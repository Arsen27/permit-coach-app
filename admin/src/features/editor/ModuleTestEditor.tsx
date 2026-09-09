import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type { BankQuestion } from '@admin/api/types';
import { GhostButton, PrimaryButton, Spacer } from '@admin/features/shell/ui';
import { admin } from '@admin/styles/theme';

// A module test is a selection from the module's own question bank, not a
// separate set of questions — so this picks which of them belong to the test.

type Props = {
  courseId: string;
  draftId: string;
  moduleId: string;
  moduleTitle: string;
  selected?: string[];
  onClose: () => void;
  onSaved: () => void;
};

const ModuleTestEditor: React.FC<Props> = ({
  courseId,
  draftId,
  moduleId,
  moduleTitle,
  selected = [],
  onClose,
  onSaved,
}) => {
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null);
  const [picked, setPicked] = useState<string[]>(selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void adminApi
      .questions(courseId, draftId, moduleId)
      .then(response => {
        if (live) {
          setQuestions(response.questions);
        }
      })
      .catch(() => {
        if (live) {
          setQuestions([]);
        }
      });
    return () => {
      live = false;
    };
  }, [courseId, draftId, moduleId]);

  const byLesson = useMemo(() => {
    const groups = new Map<string, BankQuestion[]>();
    for (const question of questions ?? []) {
      const key = question.lessonId ?? 'Unassigned';
      groups.set(key, [...(groups.get(key) ?? []), question]);
    }
    return [...groups.entries()];
  }, [questions]);

  const toggle = (questionId: string) =>
    setPicked(current =>
      current.includes(questionId)
        ? current.filter(id => id !== questionId)
        : [...current, questionId],
    );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.setModuleTest(courseId, draftId, moduleId, picked);
      onSaved();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop onClick={onClose}>
      <Dialog onClick={event => event.stopPropagation()}>
        <Title>Module test — {moduleTitle}</Title>
        <Subtitle>
          Pick the questions this module's test draws from. They come from the
          module's own lessons, so a learner is only tested on what it taught.
        </Subtitle>

        <Count>
          {picked.length} selected
          {picked.length === 0 && ' — the test will be empty'}
        </Count>

        <List>
          {questions == null ? (
            <Loading>loading questions…</Loading>
          ) : (
            byLesson.map(([lessonId, group]) => (
              <Group key={lessonId}>
                <GroupTitle>{lessonId}</GroupTitle>
                {group.map(question => (
                  <Row
                    key={question.questionId}
                    $on={picked.includes(question.questionId)}
                    onClick={() => toggle(question.questionId)}
                  >
                    <Box $on={picked.includes(question.questionId)} />
                    <Prompt>{question.prompt}</Prompt>
                  </Row>
                ))}
              </Group>
            ))
          )}
        </List>

        {error != null && <Error>{error}</Error>}

        <Actions>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <Spacer />
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            Save module test
          </PrimaryButton>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};

export default ModuleTestEditor;

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
  width: 560px;
  max-height: 76vh;
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

const Count = styled.span`
  display: block;
  font: 600 11px ${admin.mono};
  color: ${admin.accent};
  margin-bottom: 8px;
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
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  background: ${({ $on }) => ($on ? admin.accentSoft : 'transparent')};

  &:hover {
    background: ${({ $on }) => ($on ? admin.accentSoft : admin.bg)};
  }
`;

const Box = styled.div<{ $on: boolean }>`
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 2px;
  border-radius: 4px;
  border: 1.5px solid ${({ $on }) => ($on ? admin.accent : '#D4D4D8')};
  background: ${({ $on }) => ($on ? admin.accent : 'transparent')};
  position: relative;

  &::after {
    content: '';
    display: ${({ $on }) => ($on ? 'block' : 'none')};
    position: absolute;
    left: 3.5px;
    top: 1px;
    width: 3px;
    height: 6px;
    border-right: 1.6px solid #fff;
    border-bottom: 1.6px solid #fff;
    transform: rotate(45deg);
  }
`;

const Prompt = styled.span`
  font-size: 12px;
  line-height: 1.45;
  font-weight: 500;
  color: ${admin.body};
`;

const Loading = styled.div`
  padding: 20px;
  text-align: center;
  font: 500 11px ${admin.mono};
  color: ${admin.dim2};
`;

const Error = styled.p`
  margin: 10px 0 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #b91c1c;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 16px;
`;
