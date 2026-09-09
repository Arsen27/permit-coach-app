import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type { CourseSummary } from '@admin/api/types';
import QuestionEditor from '@admin/features/editor/QuestionEditor';
import { Select } from '@admin/features/editor/fields';
import { uploadArtwork } from '@admin/model/svg';
import {
  Chip,
  GhostButton,
  Mono,
  PrimaryButton,
  Row,
  SectionLabel,
  Spacer,
} from '@admin/features/shell/ui';
import {
  changedQuestionCount,
  findBankQuestion,
  useBank,
} from '@admin/store/bankStore';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

// The question bank, edited where it lives. Questions are the course's own
// entity: lessons and module tests reference them by id, and the app
// downloads the bank on its own — so a fix here reaches every learner on
// their next lesson without a course release, exactly like the signs
// catalogue. Edit, Save, publish to staging, look at it, publish to
// everyone; rolling back is publishing an earlier sha.

const QuestionsScreen: React.FC = () => {
  const state = useBank();
  const showToast = useUi(s => s.showToast);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const filePick = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void adminApi
      .workspace()
      .then(workspace => {
        setCourses(workspace.courses);
        const first = workspace.courses[0]?.courseId;
        if (first != null) {
          void useBank.getState().open(first);
        }
      })
      .catch(() => setCourses([]));
  }, []);

  const doc = state.doc;
  const changed = changedQuestionCount(state);
  const stagingSha = state.channels?.staging?.sha256 ?? null;
  const productionSha = state.channels?.production?.sha256 ?? null;
  const workingSha = state.channels?.working?.sha256 ?? null;
  // Saving writes the working document; devices download a channel. The
  // difference between them is invisible unless it is said out loud, and a
  // save nobody publishes reaches nobody.
  const unpublished =
    workingSha != null && productionSha != null && workingSha !== productionSha;
  const selected = findBankQuestion(doc, selectedId);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (doc?.questions ?? []).filter(
      question =>
        needle.length === 0 ||
        question.prompt.toLowerCase().includes(needle) ||
        question.questionId.toLowerCase().includes(needle),
    );
  }, [doc, query]);

  // The pictures the bank carries, so the editor can draw and describe them
  // here — a question's artwork travels with the question, not with whatever
  // lesson happens to ask it.
  const assets = useMemo(
    () => new Map((doc?.assets ?? []).map(asset => [asset.assetId, asset])),
    [doc],
  );

  // Uploading first: a question points at a picture, so the picture has to
  // exist before it can be named.
  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file == null || selected == null) {
      return;
    }
    try {
      const uploaded = await uploadArtwork(file);
      const assetId = selected.assetId ?? `${selected.questionId}-img`;
      state.mutate(bank => {
        bank.questions = bank.questions.map(question =>
          question.questionId === selected.questionId
            ? { ...question, assetId }
            : question,
        );
        const existing = assets.get(assetId);
        const next = {
          assetId,
          mime: uploaded.mime,
          sha256: uploaded.sha256,
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          alt:
            existing?.alt ??
            file.name.replace(/\.(svg|png|jpe?g)$/i, '').replace(/[-_]+/g, ' '),
        };
        bank.assets = [
          ...(bank.assets ?? []).filter(asset => asset.assetId !== assetId),
          next,
        ];
      });
      showToast('Picture uploaded — Save to keep it');
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const removePicture = () => {
    if (selected?.assetId == null) {
      return;
    }
    const assetId = selected.assetId;
    state.mutate(bank => {
      bank.questions = bank.questions.map(question =>
        question.questionId === selected.questionId
          ? { ...question, assetId: undefined }
          : question,
      );
      // A picture nothing asks for is refused by the validator, so it goes
      // with the reference.
      bank.assets = (bank.assets ?? []).filter(
        asset => asset.assetId !== assetId,
      );
    });
  };

  const outOfPractice = (doc?.questions ?? []).filter(
    question => question.inPractice === false,
  ).length;

  const save = async () => {
    const errors = await state.save();
    setSaveErrors(errors ?? []);
    if (errors == null) {
      showToast('Saved — publish to send it to devices');
      // Saving moves the working document, so its sha moved with it.
      void useBank.getState().refreshChannels();
    }
  };

  return (
    <Screen>
      <ListColumn>
        <ListHeader>
          <SectionLabel>Questions</SectionLabel>
          <Spacer />
          <Select
            value={state.courseId ?? ''}
            title="Each course has its own question bank"
            onChange={event => {
              setSelectedId(null);
              void useBank.getState().open(event.target.value);
            }}
          >
            {(courses ?? []).map(course => (
              <option key={course.courseId} value={course.courseId}>
                {course.courseId}
              </option>
            ))}
          </Select>
        </ListHeader>

        <Search
          value={query}
          placeholder="Search every question"
          onChange={event => setQuery(event.target.value)}
        />

        <List>
          {state.loading ? (
            <Note>loading questions…</Note>
          ) : state.error != null ? (
            <Note>{state.error}</Note>
          ) : shown.length === 0 ? (
            <Note>
              {doc == null
                ? 'No bank for this course yet.'
                : 'Nothing matches.'}
            </Note>
          ) : (
            shown.map(question => (
              <QuestionRow
                key={question.questionId}
                data-bank-question={question.questionId}
                $selected={question.questionId === selectedId}
                onClick={() => setSelectedId(question.questionId)}
              >
                <RowPrompt>{question.prompt}</RowPrompt>
                <RowMeta>
                  {question.questionId}
                  {question.inPractice === false && ' · lesson only'}
                </RowMeta>
              </QuestionRow>
            ))
          )}
        </List>
      </ListColumn>

      <EditColumn>
        <Toolbar $gap={8}>
          <Chip $color={admin.dim} $bg={admin.bg}>
            staging {stagingSha?.slice(0, 8) ?? '—'}
          </Chip>
          <Chip
            $color={
              stagingSha != null && stagingSha !== productionSha
                ? '#B45309'
                : admin.dim
            }
            $bg={
              stagingSha != null && stagingSha !== productionSha
                ? 'rgba(217,119,6,.13)'
                : admin.bg
            }
          >
            production {productionSha?.slice(0, 8) ?? '—'}
          </Chip>
          <Mono $size={10}>
            {(doc?.questions ?? []).length} questions
            {outOfPractice > 0 && ` · ${outOfPractice} lesson-only`}
          </Mono>
          {unpublished && (
            <Chip $color="#B45309" $bg="rgba(217,119,6,.13)">
              not published
            </Chip>
          )}
          <Spacer />
          <GhostButton
            onClick={() => setHistoryOpen(open => !open)}
            aria-expanded={historyOpen}
          >
            History
          </GhostButton>
          <GhostButton
            disabled={state.saving || changed > 0 || doc == null}
            title={
              changed > 0
                ? 'Save first — staging serves what the server holds'
                : 'Put the saved bank on staging'
            }
            onClick={() => {
              void state
                .publish('staging')
                .then(result => showToast(result.detail));
            }}
          >
            Publish to staging
          </GhostButton>
          <GhostButton
            disabled={stagingSha == null || stagingSha === productionSha}
            title={
              stagingSha == null
                ? 'Nothing on staging yet'
                : 'Everyone gets what staging is serving'
            }
            onClick={() => {
              if (
                stagingSha == null ||
                !window.confirm(
                  `Publish ${stagingSha.slice(
                    0,
                    12,
                  )} to production? Every learner gets these questions on their next lesson.`,
                )
              ) {
                return;
              }
              void state
                .publish('production', stagingSha)
                .then(result => showToast(result.detail));
            }}
          >
            Publish to production
          </GhostButton>
          <PrimaryButton
            disabled={state.saving || changed === 0}
            onClick={() => void save()}
          >
            {state.saving
              ? 'Saving…'
              : `Save${changed > 0 ? ` (${changed})` : ''}`}
          </PrimaryButton>
        </Toolbar>

        {historyOpen && (
          <History data-bank-history>
            {state.history == null ? (
              <Note>loading history…</Note>
            ) : state.history.length === 0 ? (
              <Note>Nothing published yet.</Note>
            ) : (
              state.history.map((move, index) => (
                <HistoryRow key={index} data-bank-history-row>
                  <Chip $color={admin.dim} $bg={admin.bg}>
                    {move.channel}
                  </Chip>
                  <Mono $size={10}>
                    {move.from?.slice(0, 8) ?? '—'} → {move.to.slice(0, 8)}
                  </Mono>
                  <Spacer />
                  <Mono $size={10}>{move.actor}</Mono>
                </HistoryRow>
              ))
            )}
          </History>
        )}

        {unpublished && (
          <Unpublished>
            Saved, but learners still get the older set —{' '}
            {workingSha !== stagingSha
              ? 'publish to staging, look at it on a device, then publish to production.'
              : 'staging has it; publish to production to send it to everyone.'}
          </Unpublished>
        )}

        {saveErrors.length > 0 && (
          <Errors>
            {saveErrors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </Errors>
        )}

        {selected == null ? (
          <Note>
            Pick a question. Every lesson slide and every module test that names
            it by id shows what you write here.
          </Note>
        ) : (
          <Editing>
            <PoolRow
              $on={selected.inPractice !== false}
              title="Whether the general Practice pool may draw this question. Off keeps it to the lessons and module tests that ask it by id."
              onClick={() =>
                state.mutate(next => {
                  const question = next.questions.find(
                    item => item.questionId === selected.questionId,
                  );
                  if (question != null) {
                    // Absent means in the pool, so only "out" is written.
                    if (question.inPractice === false) {
                      delete question.inPractice;
                    } else {
                      question.inPractice = false;
                    }
                  }
                })
              }
            >
              <Box $on={selected.inPractice !== false} />
              <PoolText>
                In the general Practice pool
                <PoolHint>
                  Off: only lessons and module tests that name it by id ask it.
                </PoolHint>
              </PoolText>
            </PoolRow>

            <QuestionEditor
              question={selected}
              assets={assets}
              onQuestion={next =>
                state.mutate(bank => {
                  bank.questions = bank.questions.map(question =>
                    question.questionId === next.questionId ? next : question,
                  );
                })
              }
              onAssetAlt={(assetId, alt) =>
                state.mutate(bank => {
                  bank.assets = (bank.assets ?? []).map(asset =>
                    asset.assetId === assetId ? { ...asset, alt } : asset,
                  );
                })
              }
              onPickPicture={() => filePick.current?.click()}
              onRemovePicture={
                selected.assetId == null ? undefined : removePicture
              }
            />

            <HiddenFile
              ref={filePick}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg"
              onChange={event => void onFile(event)}
            />
          </Editing>
        )}
      </EditColumn>
    </Screen>
  );
};

export default QuestionsScreen;

const Screen = styled.div`
  flex: 1;
  display: flex;
  min-width: 0;
  background: ${admin.bg};
`;

const ListColumn = styled.div`
  width: 320px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${admin.line};
  background: ${admin.surface};
`;

const ListHeader = styled(Row)`
  gap: 8px;
  padding: 12px 14px 8px;
`;

const Search = styled.input`
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${admin.body};
  margin: 0 14px 8px;
  padding: 7px 10px;
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
  padding: 0 8px 12px;
`;

const QuestionRow = styled.div<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 9px;
  border-radius: 9px;
  cursor: pointer;
  background: ${({ $selected }) =>
    $selected ? admin.accentSoft : 'transparent'};

  &:hover {
    background: ${({ $selected }) => ($selected ? admin.accentSoft : admin.bg)};
  }
`;

const RowPrompt = styled.span`
  font-size: 12px;
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

const EditColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 12px 18px 40px;
`;

const Toolbar = styled(Row)`
  padding-bottom: 10px;
  border-bottom: 1px solid ${admin.line};
`;

const Unpublished = styled.p`
  margin: 10px 0 0;
  padding: 8px 11px;
  border-radius: 9px;
  background: rgba(217, 119, 6, 0.12);
  font-size: 11.5px;
  line-height: 1.5;
  font-weight: 600;
  color: #92400e;
`;

const History = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid ${admin.line};
`;

const HistoryRow = styled(Row)`
  gap: 8px;
`;

const Editing = styled.div`
  max-width: 720px;
  padding-top: 12px;
`;

const PoolRow = styled.div<{ $on: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid ${admin.line3};
  border-radius: 10px;
  cursor: pointer;
  background: ${({ $on }) => ($on ? 'transparent' : 'rgba(217,119,6,.08)')};
`;

const Box = styled.div<{ $on: boolean }>`
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 1px;
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

const PoolText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  font-weight: 700;
  color: ${admin.body};
`;

const PoolHint = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${admin.dim};
`;

const HiddenFile = styled.input`
  display: none;
`;

const Note = styled.p`
  margin: 14px 8px;
  font-size: 11.5px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.dim2};
`;

const Errors = styled.ul`
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 11.5px;
  font-weight: 600;
  color: #b91c1c;
`;
