import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type { BankQuestion } from '@admin/api/types';
import type { CourseAssetV2 } from '@/data/course/v2/wire';
import { Chevron, Mono, Spacer } from '@admin/features/shell/ui';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

// Every question this draft's lessons ask, in one list under the lesson tree
// — the tree is only where they are asked. Bodies are edited on the
// Questions screen, which owns the published bank; this is the map from a
// lesson to the questions in it.

type Props = {
  courseId: string;
  draftId: string | null;
  // Which lesson is selected, so its questions are easy to spot.
  lessonId: string | null;
};

const QuestionPool: React.FC<Props> = ({ courseId, draftId, lessonId }) => {
  const setScreen = useUi(state => state.setScreen);
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<{
    questions: BankQuestion[];
    assets: CourseAssetV2[];
  } | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (draftId == null) {
      return;
    }
    const response = await adminApi
      .questions(courseId, draftId)
      .catch(() => ({ questions: [], assets: [] }));
    setPool({
      questions: response.questions,
      assets: response.assets ?? [],
    });
  }, [courseId, draftId]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (pool?.questions ?? []).filter(
      question =>
        needle.length === 0 ||
        question.prompt.toLowerCase().includes(needle) ||
        question.questionId.toLowerCase().includes(needle),
    );
  }, [pool, query]);

  const unused = (pool?.questions ?? []).filter(
    question => question.lessonId == null,
  ).length;

  return (
    <Wrap>
      <Head onClick={() => setOpen(current => !current)}>
        <Chevron $dir={open ? 'down' : 'right'} />
        <HeadTitle>Question pool</HeadTitle>
        <Spacer />
        {pool != null && (
          <Mono $size={9.5} $weight={600}>
            {pool.questions.length}
            {unused > 0 && ` · ${unused} unused`}
          </Mono>
        )}
      </Head>

      {open && (
        <Body>
          {draftId == null ? (
            <Note>
              A released version's questions are immutable. Duplicate it into a
              draft to edit them.
            </Note>
          ) : (
            <>
              <Search
                value={query}
                placeholder="Search every question"
                onChange={event => setQuery(event.target.value)}
              />
              {pool == null ? (
                <Note>loading…</Note>
              ) : (
                shown.map(question => (
                  <QuestionRow
                    key={question.questionId}
                    data-question-id={question.questionId}
                    $here={question.lessonId === lessonId}
                    title={
                      question.lessonId == null
                        ? 'Asked by nothing today — open it on the Questions screen'
                        : `Asked in ${question.lessonId} — open it on the Questions screen`
                    }
                    onClick={() => setScreen('questions')}
                  >
                    <RowPrompt>{question.prompt}</RowPrompt>
                    <RowMeta>
                      {question.lessonId ?? 'unused'}
                      {question.assetId != null && ' · picture'}
                    </RowMeta>
                  </QuestionRow>
                ))
              )}
            </>
          )}
        </Body>
      )}
    </Wrap>
  );
};

export default QuestionPool;

const Wrap = styled.div`
  border-top: 1px solid ${admin.line3};
  margin-top: 10px;
  padding-top: 6px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 8px;

  &:hover {
    background: ${admin.bg};
  }
`;

const HeadTitle = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.body};
`;

const Body = styled.div`
  padding: 4px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const Search = styled.input`
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.body};
  padding: 6px 9px;
  margin-bottom: 4px;
  border: 1px solid ${admin.line3};
  border-radius: 8px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const QuestionRow = styled.div<{ $here: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  background: ${({ $here }) => ($here ? admin.accentSoft : 'transparent')};

  &:hover {
    background: ${({ $here }) => ($here ? admin.accentSoft : admin.bg)};
  }
`;

const RowPrompt = styled.span`
  font-size: 11.5px;
  line-height: 1.4;
  font-weight: 600;
  color: ${admin.body};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const RowMeta = styled.span`
  font: 500 9px ${admin.mono};
  color: ${admin.dim2};
`;

const Note = styled.p`
  margin: 6px 8px;
  font-size: 11px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.dim2};
`;
