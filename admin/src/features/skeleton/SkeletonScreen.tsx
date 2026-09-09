import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import CardView, { type CardSlots } from '@admin/features/viewer/CardView';
import CompareTextView from '@admin/features/viewer/CompareTextView';
import { Mono, SegmentedItem, Segmented } from '@admin/features/shell/ui';
import { SmallButton, SmallInput } from '@admin/features/editor/fields';
import { buildCompare } from '@admin/model/compare';
import {
  skeletonCards,
  skeletonTestCards,
  type SkeletonRenderCard,
} from '@admin/model/skeletonCards';
import { parameterIndex, useSkeleton } from '@admin/store/skeletonStore';
import { admin } from '@admin/styles/theme';

import { ParamText } from './ParamChip';
import ParametersPanel from './ParametersPanel';
import TrainPanel from './TrainPanel';
import SkeletonCardEditor from './SkeletonCardEditor';

// The universal skeleton, read-only.
//
// One course, every state: this is the part that is shared, and the panel had
// no way to look at it — a release could say which skeleton version built it
// and nothing could show what that version said. The lesson tree on the left,
// the cards on the right, drawn by the same components the course editor uses.
//
// Two things are marked, because they are the two ways a state's course stops
// being the skeleton:
//
//   - a yellow border on every state-specific block — the notes a state anchors
//     onto a shared card, and the lessons of the state module, which each state
//     writes for itself;
//   - a chip in place of every {{param}}, so a number or a state's name reads
//     as the variable it is rather than as text that happens to be there.
//
// It is editable now. A card of a universal lesson belongs to the skeleton, so
// saving it changes every state; a yellow one belongs to a single state, so
// saving it changes that state and no other. The editor says which before the
// save button, because getting that wrong used to be possible and silent.
//
// An explicit revision names a set of edits and freezes it: any two can be put
// side by side through the same diff the course editor uses.

const STATE_BORDER = 'rgba(217,119,6,.55)';

const SkeletonScreen: React.FC = () => {
  const view = useSkeleton(state => state.view);
  const catalogue = useSkeleton(state => state.parameters);
  const loading = useSkeleton(state => state.loading);
  const error = useSkeleton(state => state.error);
  const lessonId = useSkeleton(state => state.lessonId);
  const selectLesson = useSkeleton(state => state.selectLesson);
  const load = useSkeleton(state => state.load);
  const status = useSkeleton(state => state.status);
  const revisions = useSkeleton(state => state.revisions);
  const compare = useSkeleton(state => state.compare);
  const compareRevision = useSkeleton(state => state.compareRevision);
  const cutRevision = useSkeleton(state => state.cutRevision);
  const saving = useSkeleton(state => state.saving);
  const refusal = useSkeleton(state => state.refusal);
  const clearRefusal = useSkeleton(state => state.clearRefusal);
  const saveCard = useSkeleton(state => state.saveCard);
  const saveQuestion = useSkeleton(state => state.saveQuestion);
  const saveParam = useSkeleton(state => state.saveParam);
  const refresh = useSkeleton(state => state.refresh);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [dock, setDock] = useState<'parameters' | 'revisions' | 'train' | null>(
    null,
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const parameters = useMemo(() => parameterIndex(catalogue), [catalogue]);

  const lesson = useMemo(() => {
    if (view == null || lessonId == null) {
      return null;
    }
    for (const module of view.modules) {
      const found = module.lessons.find(
        candidate => `${candidate.stateCode ?? ''}${candidate.id}` === lessonId,
      );
      if (found != null) {
        return { module, lesson: found };
      }
    }
    return null;
  }, [view, lessonId]);

  const cards = useMemo(
    () =>
      lesson == null || view == null
        ? []
        : [
            ...skeletonCards(lesson.lesson, view.assets),
            ...skeletonTestCards(lesson.lesson, view.assets),
          ],
    [lesson, view],
  );

  // The same lesson as an earlier revision held it, run through the diff the
  // course editor already uses for two course versions.
  const against = useMemo(() => {
    if (compare == null || lesson == null) {
      return null;
    }
    const earlier = compare.view.modules
      .flatMap(module => module.lessons)
      .find(
        entry =>
          `${entry.stateCode ?? ''}${entry.id}` ===
          `${lesson.lesson.stateCode ?? ''}${lesson.lesson.id}`,
      );
    if (earlier == null) {
      return null;
    }
    return buildCompare(
      cards,
      [
        ...skeletonCards(earlier, compare.view.assets),
        ...skeletonTestCards(earlier, compare.view.assets),
      ],
      true,
    );
  }, [compare, lesson, cards]);

  const skeletonStatus = status?.subjects.find(
    entry => entry.subject === 'skeleton',
  );

  if (error != null) {
    return <Centered>{error}</Centered>;
  }
  if (view == null) {
    return (
      <Centered>{loading ? 'loading the skeleton…' : 'no skeleton'}</Centered>
    );
  }

  return (
    <Layout>
      <Tree>
        <TreeHead>
          <Mono $size={10.5} $weight={700}>
            {view.skeletonVersion}
          </Mono>
          <Revision title={`Document revision ${view.revision}`}>
            {view.revision.slice(0, 12)}
          </Revision>
        </TreeHead>
        <TreeCounts>
          {view.counts.universalLessons} universal lessons ·{' '}
          {view.counts.universalCards} cards · {view.counts.stateNotes} state
          notes · {view.counts.stateLessons} state lessons ·{' '}
          {view.counts.parameters} parameters
        </TreeCounts>
        <TreeScroll>
          {view.modules.map((module, moduleIndex) => (
            <ModuleGroup key={module.id}>
              <ModuleRow $state={module.scope === 'state_specific'}>
                <Ordinal>{String(moduleIndex + 1).padStart(2, '0')}</Ordinal>
                <ModuleTitle>
                  <ParamText text={module.title} parameters={parameters} />
                </ModuleTitle>
                {module.scope === 'state_specific' && (
                  <StateTag>per state</StateTag>
                )}
              </ModuleRow>
              {module.lessons.map(item => {
                const key = `${item.stateCode ?? ''}${item.id}`;
                const notes = item.blocks.filter(
                  block => block.scope === 'state_specific',
                ).length;
                return (
                  <LessonRow
                    key={key}
                    $selected={key === lessonId}
                    onClick={() => selectLesson(key)}
                  >
                    {item.stateCode != null && (
                      <StateBadge>{item.stateCode}</StateBadge>
                    )}
                    <LessonTitle>{item.title}</LessonTitle>
                    {item.stateCode == null && notes > 0 && (
                      <NoteCount title={`${notes} state notes anchored here`}>
                        {notes}
                      </NoteCount>
                    )}
                  </LessonRow>
                );
              })}
            </ModuleGroup>
          ))}
        </TreeScroll>
      </Tree>

      <Viewer>
        <Bar>
          <Segmented>
            <SegmentedItem $active={dock == null} onClick={() => setDock(null)}>
              Lesson
            </SegmentedItem>
            <SegmentedItem
              $active={dock === 'parameters'}
              onClick={() => setDock('parameters')}
            >
              Parameters
            </SegmentedItem>
            <SegmentedItem
              $active={dock === 'revisions'}
              onClick={() => setDock('revisions')}
            >
              Revisions
            </SegmentedItem>
            <SegmentedItem
              $active={dock === 'train'}
              onClick={() => setDock('train')}
            >
              Train
            </SegmentedItem>
          </Segmented>
          <BarNote data-authoring-status>
            revision {skeletonStatus?.revision ?? 0} ·{' '}
            {skeletonStatus?.editsSinceRevision ?? 0} edit(s) since it
            {status?.courses.map(course => (
              <span key={course.courseId}>
                {' '}
                · {course.courseId} {course.edits} edit(s) since its last
                release
              </span>
            ))}
          </BarNote>
        </Bar>

        {lesson == null ? (
          <Centered>Select a lesson</Centered>
        ) : (
          <Scroll>
            <Column>
              <Head>
                <Title>{lesson.lesson.title}</Title>
                <Meta>
                  {lesson.module.title.replace(/\{\{\w[\w.]*\}\}/g, '…')} ·{' '}
                  {cards.length} cards ·{' '}
                  {lesson.lesson.stateCode == null
                    ? 'universal'
                    : `${lesson.lesson.stateCode} state lesson`}
                </Meta>
              </Head>
              <Objective>
                <ParamText
                  text={lesson.lesson.objective}
                  parameters={parameters}
                />
              </Objective>
              <Legend>
                <LegendItem>
                  <Swatch $color={STATE_BORDER} /> state-specific block
                </LegendItem>
                <LegendItem>
                  <ChipSample>param</ChipSample> resolved per state at build
                  time
                </LegendItem>
                <LegendItem>
                  editing a shared card changes every state
                </LegendItem>
              </Legend>

              {against != null ? (
                <CompareTextView
                  rows={against.rows}
                  leftLabel="working"
                  rightLabel={`revision ${compare?.revision ?? ''}`}
                  leftAbsentNote={null}
                />
              ) : (
                <Cards>
                  {cards.map((card, index) =>
                    editingKey === card.key ? (
                      <CardSlot
                        key={card.key}
                        data-skeleton-block={card.scope}
                        data-skeleton-editing={card.key}
                      >
                        <SkeletonCardEditor
                          card={card}
                          stateCode={card.stateCode}
                          saving={saving}
                          refusal={refusal}
                          onCancel={() => {
                            clearRefusal();
                            setEditingKey(null);
                          }}
                          onSave={async patch => {
                            const ok = await saveCard(
                              card.refs.blockId ?? card.key,
                              patch,
                              card.stateCode,
                            );
                            if (ok) {
                              setEditingKey(null);
                            }
                          }}
                          onSaveQuestion={async patch => {
                            const ok = await saveQuestion(
                              card.refs.questionId ?? card.key,
                              patch,
                              card.stateCode,
                            );
                            if (ok) {
                              setEditingKey(null);
                            }
                          }}
                        />
                      </CardSlot>
                    ) : (
                      <CardSlot key={card.key} data-skeleton-block={card.scope}>
                        <SlotHead>
                          {card.scope === 'state_specific' && (
                            <ScopeTag>
                              {card.stateCode ?? 'state'} only
                              {card.after != null && ` · after ${card.after}`}
                            </ScopeTag>
                          )}
                          {card.type !== 'image' && (
                            <EditLink
                              data-skeleton-edit={card.key}
                              onClick={() => {
                                clearRefusal();
                                setEditingKey(card.key);
                              }}
                            >
                              {card.scope === 'state_specific'
                                ? `Edit for ${card.stateCode}`
                                : 'Edit shared'}
                            </EditLink>
                          )}
                        </SlotHead>
                        <CardView
                          card={card}
                          index={index}
                          borderColor={
                            card.scope === 'state_specific'
                              ? STATE_BORDER
                              : undefined
                          }
                          slots={slotsFor(card, parameters)}
                        />
                        {card.rules != null && card.rules.length > 0 && (
                          <Rules>{card.rules.join(' · ')}</Rules>
                        )}
                      </CardSlot>
                    ),
                  )}
                </Cards>
              )}
            </Column>
          </Scroll>
        )}
      </Viewer>

      {dock === 'parameters' && catalogue != null && (
        <ParametersPanel
          catalogue={catalogue}
          saving={saving}
          refusal={refusal}
          onSave={(stateCode, key, param) => {
            void saveParam(stateCode, key, param);
          }}
        />
      )}

      {dock === 'train' && (
        <TrainPanel
          onGenerated={() => {
            void refresh();
          }}
        />
      )}

      {dock === 'revisions' && (
        <RevisionPanel>
          <PanelTitle>Revisions</PanelTitle>
          <Cut>
            <SmallInput
              value={message}
              placeholder="What this revision holds"
              aria-label="Revision message"
              onChange={event => setMessage(event.target.value)}
            />
            <SmallButton
              disabled={saving || message.trim().length === 0}
              data-cut-revision
              onClick={async () => {
                if (await cutRevision(message.trim())) {
                  setMessage('');
                }
              }}
            >
              Cut revision
            </SmallButton>
          </Cut>
          {refusal != null && (
            <Refused>
              {refusal.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </Refused>
          )}
          <RevisionRows>
            {revisions.length === 0 && (
              <Empty>No revision has been cut yet.</Empty>
            )}
            {revisions.map(revision => (
              <RevisionRow
                key={revision.revision}
                $active={compare?.revision === revision.revision}
                data-revision={revision.revision}
                onClick={() =>
                  void compareRevision(
                    compare?.revision === revision.revision
                      ? null
                      : revision.revision,
                  )
                }
              >
                <Mono $size={10.5} $weight={700}>
                  r{revision.revision}
                </Mono>
                <RevisionMessage>{revision.message}</RevisionMessage>
                <Mono $size={9}>{revision.contentSha.slice(0, 8)}</Mono>
              </RevisionRow>
            ))}
          </RevisionRows>
          <PanelNote>
            Selecting a revision diffs the open lesson against it, in the viewer
            the course editor uses for two versions.
          </PanelNote>
        </RevisionPanel>
      )}
    </Layout>
  );
};

export default SkeletonScreen;

// Every text slot of a card, with its placeholders turned into chips. The card
// renderer takes nodes wherever it takes a string, which is the seam that makes
// this possible without a second card component.
const slotsFor = (
  card: SkeletonRenderCard,
  parameters: Parameters<typeof ParamText>[0]['parameters'],
): CardSlots => ({
  title: <ParamText text={card.title} parameters={parameters} />,
  ...(card.ask != null && {
    ask: <ParamText text={card.ask} parameters={parameters} />,
  }),
  bodies: card.bodies.map((body, index) => (
    <ParamText key={index} text={body} parameters={parameters} />
  )),
  ...(card.options != null && {
    options: card.options.map((option, index) => (
      <ParamText key={index} text={option.text} parameters={parameters} />
    )),
  }),
});

const Layout = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

const Tree = styled.aside`
  flex: none;
  width: 268px;
  border-right: 1px solid ${admin.line};
  background: ${admin.surface};
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const TreeHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 4px;
`;

const Revision = styled.span`
  font: 500 10px ${admin.mono};
  color: ${admin.dim2};
  cursor: help;
`;

const TreeCounts = styled.p`
  margin: 0;
  padding: 0 14px 10px;
  font-size: 10.5px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.faint};
  border-bottom: 1px solid ${admin.line};
`;

const TreeScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 8px 40px;
`;

const ModuleGroup = styled.div`
  margin-bottom: 8px;
`;

const ModuleRow = styled.div<{ $state: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 8px 5px;
  border-left: 2px solid
    ${({ $state }) => ($state ? STATE_BORDER : 'transparent')};
`;

const Ordinal = styled.span`
  font: 600 9.5px ${admin.mono};
  color: ${admin.ghost};
`;

const ModuleTitle = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: ${admin.muted};
`;

const StateTag = styled.span`
  font: 700 8.5px ${admin.mono};
  color: #b45309;
  background: rgba(217, 119, 6, 0.13);
  padding: 2px 6px;
  border-radius: 99px;
`;

const LessonRow = styled.button<{ $selected: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border: none;
  border-radius: 8px;
  background: ${({ $selected }) =>
    $selected ? admin.accentSoft : 'transparent'};
  cursor: pointer;
  font-family: inherit;
  text-align: left;

  &:hover {
    background: ${({ $selected }) =>
      $selected ? admin.accentSoft : admin.hair};
  }
`;

const LessonTitle = styled.span`
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: ${admin.body};
`;

const StateBadge = styled.span`
  font: 700 9px ${admin.mono};
  color: #b45309;
  background: rgba(217, 119, 6, 0.13);
  padding: 2px 5px;
  border-radius: 5px;
`;

const NoteCount = styled.span`
  font: 700 9px ${admin.mono};
  color: #b45309;
  background: rgba(217, 119, 6, 0.13);
  padding: 2px 6px;
  border-radius: 99px;
`;

const Viewer = styled.section`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px 26px 60px;
`;

const Column = styled.div`
  max-width: 680px;
  margin: 0 auto;
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const Meta = styled.span`
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const Objective = styled.p`
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.dim};
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${admin.line};
`;

const LegendItem = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 600;
  color: ${admin.faint};
`;

const Swatch = styled.span<{ $color: string }>`
  width: 18px;
  height: 10px;
  border-radius: 3px;
  border: 1.5px solid ${({ $color }) => $color};
`;

const ChipSample = styled.span`
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid rgba(4, 133, 247, 0.32);
  background: ${admin.accentSoft};
  color: #0369a1;
  font: 600 10px ${admin.mono};
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 13px;
`;

const CardSlot = styled.div`
  position: relative;
`;

const ScopeTag = styled.span`
  display: inline-block;
  margin-bottom: 5px;
  font: 700 9px ${admin.mono};
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #b45309;
  background: rgba(217, 119, 6, 0.13);
  padding: 2px 7px;
  border-radius: 99px;
`;

const Rules = styled.p`
  margin: 5px 0 0;
  font: 500 9.5px ${admin.mono};
  color: ${admin.faint};
`;

const Centered = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 500 12px ${admin.mono};
  color: ${admin.dim2};
`;

const Bar = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 26px;
  border-bottom: 1px solid ${admin.line};
  background: ${admin.surface};
`;

const BarNote = styled.span`
  font: 500 10px ${admin.mono};
  color: ${admin.faint};
`;

const SlotHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
`;

const EditLink = styled.button`
  margin-left: auto;
  border: 1px solid ${admin.line3};
  border-radius: 7px;
  background: ${admin.soft};
  padding: 3px 9px;
  font: 700 9.5px ${admin.mono};
  color: ${admin.muted};
  cursor: pointer;

  &:hover {
    background: ${admin.hair};
    color: ${admin.ink};
  }
`;

const RevisionPanel = styled.aside`
  flex: none;
  width: 320px;
  border-left: 1px solid ${admin.line};
  background: ${admin.surface};
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  gap: 8px;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: ${admin.muted};
`;

const Cut = styled.div`
  display: flex;
  gap: 6px;
`;

const Refused = styled.ul`
  margin: 0;
  padding-left: 16px;
  font-size: 10.5px;
  line-height: 1.5;
  color: #b91c1c;
`;

const RevisionRows = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RevisionRow = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  background: ${({ $active }) => ($active ? admin.accentSoft : 'transparent')};

  &:hover {
    background: ${({ $active }) => ($active ? admin.accentSoft : admin.hair)};
  }
`;

const RevisionMessage = styled.span`
  flex: 1;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.body};
`;

const PanelNote = styled.p`
  margin: 0;
  font-size: 10px;
  line-height: 1.5;
  color: ${admin.faint};
`;

const Empty = styled.p`
  margin: 0;
  font-size: 11px;
  color: ${admin.faint};
`;
