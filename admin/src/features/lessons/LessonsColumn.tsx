import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type { Outline, OutlineLesson, StructureOp } from '@admin/api/types';
import {
  Chevron,
  Chip,
  CollapsedRail,
  IconButton,
  Mono,
  Row,
  Spacer,
} from '@admin/features/shell/ui';
import QuestionPool from '@admin/features/lessons/QuestionPool';
import { formatLabel, statusOf } from '@admin/model/versionDescriptor';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import { selectOutline, useDocs } from '@admin/store/docsStore';
import { useEdit } from '@admin/store/editStore';
import { useSelection } from '@admin/store/selectionStore';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

// The module/lesson tree of whichever version the sidebar has selected.
// Structural editing is offered only for drafts — releases are immutable.

type Props = {
  version: VersionDescriptor | null;
  onEditModuleTest?: (
    moduleId: string,
    title: string,
    questionIds: string[],
  ) => void;
};

const ordinal = (index: number) => String(index + 1).padStart(2, '0');

const InlineRename: React.FC<{
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}> = ({ value, onCommit, onCancel }) => {
  const [draft, setDraft] = useState(value);

  return (
    <RenameInput
      autoFocus
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onClick={event => event.stopPropagation()}
      onBlur={() => onCommit(draft.trim())}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          onCommit(draft.trim());
        }
        if (event.key === 'Escape') {
          onCancel();
        }
      }}
    />
  );
};

const LessonsColumn: React.FC<Props> = ({ version, onEditModuleTest }) => {
  const open = useUi(state => state.lessonsOpen);
  const toggle = useUi(state => state.toggleLessons);
  const showToast = useUi(state => state.showToast);

  const outline = useDocs(state => selectOutline(state, version?.key ?? null));
  const loadOutline = useDocs(state => state.loadOutline);
  const putOutline = useDocs(state => state.putOutline);
  const invalidate = useDocs(state => state.invalidate);
  const editing = useEdit(state => state.editing);

  const lessonId = useSelection(state => state.lessonId);
  const refLessonId = useSelection(state => state.refLessonId);
  const syncOn = useSelection(state => state.syncOn);
  const compareOn = useSelection(state => state.compareOn);
  const refPick = useSelection(state => state.refPick);
  const selectLesson = useSelection(state => state.selectLesson);

  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    if (version != null) {
      void loadOutline(version);
    }
  }, [version, loadOutline]);

  const totals = useMemo(() => {
    const lessons =
      outline?.modules.reduce(
        (sum, module) => sum + module.lessons.length,
        0,
      ) ?? 0;
    return { modules: outline?.modules.length ?? 0, lessons };
  }, [outline]);

  const isDraft = version?.kind === 'draft';

  const mutate = async (op: StructureOp) => {
    if (version?.draftId == null || version.courseId == null) {
      return;
    }
    // The lesson editor saves the whole lesson document, title included: a
    // rename underneath it would be written back over on save.
    if (editing) {
      showToast('Finish or discard the lesson edit first');
      return;
    }
    try {
      const next = await adminApi.structure(
        version.courseId,
        version.draftId,
        op,
      );
      // A rename changes the documents too, not only the tree.
      invalidate(version.key);
      putOutline(version.key, next as Outline);
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  if (!open) {
    return (
      <CollapsedRail title="Show lessons" $bg={admin.surface} onClick={toggle}>
        <Chevron $dir="right" />
      </CollapsedRail>
    );
  }

  const status = version == null ? null : admin.status[statusOf(version)];

  return (
    <Panel>
      <Head>
        <Row>
          <Mono $size={15} $weight={700}>
            {version?.label ?? '—'}
          </Mono>
          {status != null && (
            <Chip $color={status.col} $bg={status.bg}>
              {status.chip}
            </Chip>
          )}
          <Spacer />
          <IconButton title="Collapse" onClick={toggle}>
            <Chevron $dir="left" />
          </IconButton>
        </Row>
        <HeadMeta>
          {version == null
            ? 'No version selected'
            : `${formatLabel(version.format)} · ${totals.modules} modules · ${
                totals.lessons
              } lessons`}
        </HeadMeta>
      </Head>

      {compareOn && refPick && (
        <RefBanner>Choosing for the right pane — click any lesson</RefBanner>
      )}

      <Scroll>
        {outline?.modules.map((module, moduleIndex) => (
          <ModuleGroup key={module.moduleId}>
            <ModuleHead>
              <Mono $size={9.5} $weight={600}>
                {ordinal(moduleIndex)}
              </Mono>
              {renaming === `m:${module.moduleId}` ? (
                <InlineRename
                  value={module.title}
                  onCancel={() => setRenaming(null)}
                  onCommit={title => {
                    setRenaming(null);
                    if (title.length > 0 && title !== module.title) {
                      void mutate({
                        kind: 'module-rename',
                        moduleId: module.moduleId,
                        title,
                      });
                    }
                  }}
                />
              ) : (
                <ModuleTitle>{module.title}</ModuleTitle>
              )}
              <Spacer />
              {isDraft && (
                <Controls>
                  <IconButton
                    title="Move module up"
                    onClick={() =>
                      void mutate({
                        kind: 'module-move',
                        moduleId: module.moduleId,
                        direction: -1,
                      })
                    }
                  >
                    <Chevron $dir="up" />
                  </IconButton>
                  <IconButton
                    title="Move module down"
                    onClick={() =>
                      void mutate({
                        kind: 'module-move',
                        moduleId: module.moduleId,
                        direction: 1,
                      })
                    }
                  >
                    <Chevron $dir="down" />
                  </IconButton>
                  <IconButton
                    title="Rename module"
                    onClick={() => setRenaming(`m:${module.moduleId}`)}
                  >
                    ✎
                  </IconButton>
                  <IconButton
                    title="Add lesson"
                    onClick={() =>
                      void mutate({
                        kind: 'lesson-add',
                        moduleId: module.moduleId,
                        title: 'Untitled lesson',
                      })
                    }
                  >
                    +
                  </IconButton>
                  <IconButton
                    title="Delete module"
                    disabled={(outline?.modules.length ?? 0) <= 1}
                    onClick={() => {
                      const count = module.lessons.length;
                      if (
                        window.confirm(
                          `Delete "${module.title}"${
                            count === 0
                              ? ''
                              : ` and its ${count} lesson${
                                  count === 1 ? '' : 's'
                                }`
                          }? Their questions and pictures go with them.`,
                        )
                      ) {
                        void mutate({
                          kind: 'module-delete',
                          moduleId: module.moduleId,
                        });
                      }
                    }}
                  >
                    ✕
                  </IconButton>
                </Controls>
              )}
            </ModuleHead>

            {module.lessons.map((lesson, lessonIndex) => (
              <LessonRow
                key={lesson.lessonId}
                lesson={lesson}
                index={lessonIndex}
                selected={lesson.lessonId === lessonId}
                isReference={
                  compareOn &&
                  !syncOn &&
                  (refLessonId ?? lessonId) === lesson.lessonId
                }
                editable={isDraft}
                renaming={renaming === `l:${lesson.lessonId}`}
                onStartRename={() => setRenaming(`l:${lesson.lessonId}`)}
                onCancelRename={() => setRenaming(null)}
                onRename={title => {
                  setRenaming(null);
                  if (title.length > 0 && title !== lesson.title) {
                    void mutate({
                      kind: 'lesson-rename',
                      lessonId: lesson.lessonId,
                      title,
                    });
                  }
                }}
                onMove={direction =>
                  void mutate({
                    kind: 'lesson-move',
                    moduleId: module.moduleId,
                    lessonId: lesson.lessonId,
                    direction,
                  })
                }
                onDelete={() => {
                  if (
                    window.confirm(
                      `Delete "${lesson.title}"? Its questions and pictures go with it.`,
                    )
                  ) {
                    void mutate({
                      kind: 'lesson-delete',
                      lessonId: lesson.lessonId,
                    });
                  }
                }}
                onClick={() => selectLesson(lesson.lessonId)}
              />
            ))}

            <ModuleTestRow
              $editable={isDraft}
              title={
                isDraft
                  ? 'Choose which questions this module test draws from'
                  : 'Module test — questions drawn from this module'
              }
              onClick={
                isDraft && onEditModuleTest != null
                  ? () =>
                      onEditModuleTest(
                        module.moduleId,
                        module.title,
                        module.moduleTestQuestionIds,
                      )
                  : undefined
              }
            >
              <Mono $size={10} $weight={600}>
                T
              </Mono>
              <ModuleTestLabel>Module test</ModuleTestLabel>
              <Spacer />
              <ModuleTestCount>
                {module.moduleTestQuestionCount} questions
              </ModuleTestCount>
            </ModuleTestRow>
          </ModuleGroup>
        ))}

        {isDraft && (
          <AddModule
            onClick={() =>
              void mutate({ kind: 'module-add', title: 'New module' })
            }
          >
            + Add module
          </AddModule>
        )}

        {version?.courseId != null && (
          <QuestionPool
            courseId={version.courseId}
            draftId={version.draftId ?? null}
            lessonId={lessonId}
          />
        )}
      </Scroll>
    </Panel>
  );
};

type LessonRowProps = {
  lesson: OutlineLesson;
  index: number;
  selected: boolean;
  isReference: boolean;
  editable: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
  onRename: (title: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onClick: () => void;
};

const LessonRow: React.FC<LessonRowProps> = ({
  lesson,
  index,
  selected,
  isReference,
  editable,
  renaming,
  onStartRename,
  onCancelRename,
  onRename,
  onMove,
  onDelete,
  onClick,
}) => (
  <LessonItem
    $selected={selected}
    $reference={isReference}
    aria-current={selected ? 'true' : undefined}
    data-lesson-id={lesson.lessonId}
    onClick={onClick}
  >
    <Mono $size={10} $weight={600}>
      {ordinal(index)}
    </Mono>
    <LessonBody>
      {renaming ? (
        <InlineRename
          value={lesson.title}
          onCommit={onRename}
          onCancel={onCancelRename}
        />
      ) : (
        <LessonTitle data-lesson-title $selected={selected}>
          {lesson.title}
        </LessonTitle>
      )}
      <LessonMeta>
        {lesson.cardCount} cards · ~{lesson.estimatedMinutes} min
      </LessonMeta>
    </LessonBody>
    {editable && selected && !renaming && (
      <Controls onClick={event => event.stopPropagation()}>
        {/* Past the end of a module the arrow keeps going into the next
            one, so the two arrows are the whole vocabulary for placing a
            lesson anywhere in the course. */}
        <IconButton
          title="Move up — past the top it joins the module above"
          onClick={() => onMove(-1)}
        >
          <Chevron $dir="up" />
        </IconButton>
        <IconButton
          title="Move down — past the end it joins the module below"
          onClick={() => onMove(1)}
        >
          <Chevron $dir="down" />
        </IconButton>
        <IconButton title="Rename" onClick={onStartRename}>
          ✎
        </IconButton>
        <IconButton title="Delete lesson" onClick={onDelete}>
          ✕
        </IconButton>
      </Controls>
    )}
  </LessonItem>
);

export default LessonsColumn;

const Panel = styled.aside`
  flex: none;
  width: 262px;
  background: ${admin.surface};
  border-right: 1px solid ${admin.line2};
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Head = styled.div`
  flex: none;
  padding: 14px 16px 11px;
  border-bottom: 1px solid ${admin.hair};
`;

const HeadMeta = styled.span`
  display: block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const RefBanner = styled.div`
  margin: 8px 8px 0;
  padding: 8px 10px;
  border-radius: 9px;
  background: rgba(124, 58, 237, 0.1);
  font-size: 10.5px;
  line-height: 1.4;
  font-weight: 700;
  color: #6d28d9;
`;

const Scroll = styled.div`
  flex: 1;
  overflow: auto;
  padding: 4px 8px 14px;
`;

const ModuleGroup = styled.div`
  padding: 12px 6px 2px;
  color: ${admin.ghost};
`;

const ModuleHead = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 4px 4px;
`;

const ModuleTitle = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: ${admin.muted};
`;

const Controls = styled.div`
  display: flex;
  gap: 2px;
`;

const LessonItem = styled.div<{ $selected: boolean; $reference: boolean }>`
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 2px 0;
  padding: 7px 9px;
  border-radius: 9px;
  cursor: pointer;
  background: ${({ $selected, $reference }) =>
    $selected
      ? admin.accentSoft
      : $reference
      ? 'rgba(124,58,237,.08)'
      : 'transparent'};

  &:hover {
    background: ${({ $selected }) => ($selected ? admin.accentSoft : admin.bg)};
  }
`;

const LessonBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const LessonTitle = styled.span<{ $selected: boolean }>`
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ $selected }) => ($selected ? admin.ink : admin.body)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LessonMeta = styled.span`
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: ${admin.dim2};
  margin-top: 1px;
`;

const ModuleTestRow = styled.div<{ $editable: boolean }>`
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 4px 0 2px;
  padding: 6px 9px;
  border-radius: 9px;
  border: 1px dashed ${admin.line};
  color: ${admin.ghost};
  cursor: ${({ $editable }) => ($editable ? 'pointer' : 'default')};

  &:hover {
    border-color: ${({ $editable }) => ($editable ? admin.accent : admin.line)};
  }
`;

const ModuleTestLabel = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.dim};
`;

const ModuleTestCount = styled.span`
  font-size: 10px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const AddModule = styled.button`
  display: block;
  width: calc(100% - 12px);
  margin: 12px 6px 0;
  padding: 8px;
  border: 1.5px dashed #d9d9dc;
  border-radius: 9px;
  background: transparent;
  text-align: center;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.dim};
  cursor: pointer;

  &:hover {
    border-color: ${admin.accent};
    color: ${admin.accent};
  }
`;

const RenameInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-size: 12.5px;
  font-weight: 600;
  color: ${admin.ink};
  border: 1px solid ${admin.accent};
  border-radius: 6px;
  padding: 2px 6px;
  outline: none;
`;
