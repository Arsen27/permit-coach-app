import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import EditCardList from '@admin/features/editor/EditCardList';
import EditFooterBar from '@admin/features/editor/EditFooterBar';
import ModuleTestEditor from '@admin/features/editor/ModuleTestEditor';
import PublishModal from '@admin/features/editor/PublishModal';
import ReleaseModal from '@admin/features/editor/ReleaseModal';
import SlideTypesModal from '@admin/features/editor/SlideTypesModal';
import VersionModal from '@admin/features/editor/VersionModal';
import LessonsColumn from '@admin/features/lessons/LessonsColumn';
import PhoneModeView from '@admin/features/phone/PhoneModeView';
import ContextMenu, { menuPosition } from '@admin/features/prompt/ContextMenu';
import PromptPanel from '@admin/features/prompt/PromptPanel';
import SimilarPanel from '@admin/features/similar/SimilarPanel';
import VersionsSidebar from '@admin/features/versions/VersionsSidebar';
import CompareHeaderRow from '@admin/features/viewer/CompareHeaderRow';
import ReferencePicker from '@admin/features/viewer/ReferencePicker';
import CompareTextView from '@admin/features/viewer/CompareTextView';
import SingleTextView from '@admin/features/viewer/SingleTextView';
import ViewerToolbar from '@admin/features/viewer/ViewerToolbar';
import { buildCompare } from '@admin/model/compare';
import { anchorOfSelection, describeAnchor } from '@admin/model/excerptAnchor';
import { renderCardsFromLessonDoc } from '@admin/model/renderCard';
import { formatLabel } from '@admin/model/versionDescriptor';
import {
  selectLesson,
  selectLoadFailure,
  selectOutline,
  useDocs,
} from '@admin/store/docsStore';
import { changedFieldCount, useEdit } from '@admin/store/editStore';
import { usePrompt } from '@admin/store/promptStore';
import { useSimilar, type SimilarTarget } from '@admin/store/similarStore';
import { useUi } from '@admin/store/uiStore';
import { referenceLessonId, useSelection } from '@admin/store/selectionStore';
import { stateOfCourse, useWorkspace } from '@admin/store/workspaceStore';
import { useSkeleton } from '@admin/store/skeletonStore';
import type { StateOrigins } from '@admin/api/types';
import { admin } from '@admin/styles/theme';

// The course screen. The sidebars on the left drive the main pane — that is
// what makes the left pane primary; the right pane is a reference chosen
// through its own picker.

const CourseEditorScreen: React.FC = () => {
  const versions = useWorkspace(state => state.versions);
  const courseId = useWorkspace(state => state.courseId);
  const courses = useWorkspace(state => state.courses);
  const settings = useWorkspace(state => state.settings);
  const reloadVersions = useWorkspace(state => state.reloadVersions);
  const competitors = useWorkspace(state => state.competitors);
  const channels = useWorkspace(state => state.channels);
  const refreshCourses = useWorkspace(state => state.refreshCourses);

  const selectedKey = useSelection(state => state.selectedKey);
  const lessonId = useSelection(state => state.lessonId);
  const compareKey = useSelection(state => state.compareKey);
  const compareOn = useSelection(state => state.compareOn);
  const mode = useSelection(state => state.mode);
  const diffOn = useSelection(state => state.diffOn);
  const syncOn = useSelection(state => state.syncOn);
  const refLesson = useSelection(referenceLessonId);
  const pickReferenceLesson = useSelection(state => state.pickReferenceLesson);
  const selectVersion = useSelection(state => state.selectVersion);
  const selectLessonId = useSelection(state => state.selectLesson);

  const loadLesson = useDocs(state => state.loadLesson);
  const loadOutline = useDocs(state => state.loadOutline);
  const invalidate = useDocs(state => state.invalidate);

  const editing = useEdit(state => state.editing);
  const editDoc = useEdit(state => state.draft);
  const beginEdit = useEdit(state => state.begin);
  const cancelEdit = useEdit(state => state.cancel);
  const saveEdit = useEdit(state => state.save);
  const editLessonId = useEdit(state => state.lessonId);
  const editChanges = useEdit(changedFieldCount);

  const rightDock = useUi(state => state.rightDock);
  const setRightDock = useUi(state => state.setRightDock);
  const openContextMenu = useUi(state => state.openContextMenu);
  const addChunk = usePrompt(state => state.add);
  const runSimilar = useSimilar(state => state.run);

  const modal = useUi(state => state.modal);
  const openModal = useUi(state => state.openModal);
  const closeModal = useUi(state => state.closeModal);
  const showToast = useUi(state => state.showToast);

  // Where each block of this state's course comes from. A version generated
  // from the skeleton is regenerated wholesale by the next build, so a shared
  // card edited here would be discarded — the badge says so before the edit,
  // and the two actions are what can be done instead.
  const [origins, setOrigins] = useState<StateOrigins | null>(null);
  const skeletonSaving = useSkeleton(state => state.saving);
  const revertShared = useSkeleton(state => state.revert);
  const promoteShared = useSkeleton(state => state.promote);
  const usStateCode = stateOfCourse(courses, courseId);

  useEffect(() => {
    if (usStateCode.length === 0) {
      setOrigins(null);
      return;
    }
    let live = true;
    void adminApi
      .stateOrigins(usStateCode)
      .then(value => {
        if (live) {
          setOrigins(value);
        }
      })
      .catch(() => setOrigins(null));
    return () => {
      live = false;
    };
  }, [usStateCode]);

  const [suggestedVersion, setSuggestedVersion] = useState('');
  const [moduleTest, setModuleTest] = useState<{
    moduleId: string;
    title: string;
    questionIds: string[];
  } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const outline = useDocs(state => selectOutline(state, selectedKey));
  const referenceOutline = useDocs(state => selectOutline(state, compareKey));
  const entry = useDocs(state => selectLesson(state, selectedKey, lessonId));
  const loadFailure = useDocs(state =>
    selectLoadFailure(state, selectedKey, lessonId),
  );
  const referenceEntry = useDocs(state =>
    selectLesson(state, compareKey, refLesson),
  );

  const all = useMemo(
    () => [...versions, ...competitors],
    [versions, competitors],
  );
  const version = all.find(item => item.key === selectedKey) ?? null;
  const reference = all.find(item => item.key === compareKey) ?? null;
  const setCompare = useSelection(state => state.setCompare);

  // Turning compare on with nothing chosen lands on the obvious reference: the
  // version this draft came from, or the release before this one.
  useEffect(() => {
    if (!compareOn || compareKey != null || version == null) {
      return;
    }
    const base =
      version.baseVersion == null
        ? undefined
        : versions.find(
            item =>
              item.kind === 'released' && item.version === version.baseVersion,
          );
    const fallback = all.find(item => item.key !== version.key);
    const chosen = base ?? fallback;
    if (chosen != null) {
      setCompare(chosen.key);
    }
  }, [compareOn, compareKey, version, versions, all, setCompare]);

  // Land on the newest version as soon as the course's list arrives.
  useEffect(() => {
    if (selectedKey == null && versions.length > 0) {
      selectVersion(versions[0].key);
    }
  }, [selectedKey, versions, selectVersion]);

  // Follow the outline into its first lesson when nothing is selected, or when
  // the current selection does not exist in this version.
  useEffect(() => {
    if (outline == null) {
      return;
    }
    const lessons = outline.modules.flatMap(module => module.lessons);
    if (lessons.length === 0) {
      return;
    }
    if (lessonId == null || !lessons.some(l => l.lessonId === lessonId)) {
      selectLessonId(lessons[0].lessonId);
    }
  }, [outline, lessonId, selectLessonId]);

  // Depending on the cached entry means any invalidation refetches on its own,
  // so a save never leaves the viewer empty.
  useEffect(() => {
    if (version != null && lessonId != null && entry == null) {
      void loadLesson(version, lessonId);
    }
  }, [version, lessonId, entry, loadLesson]);

  // The reference pane needs its version's outline before its lesson, because
  // the outline carries the state label the cards are rendered with.
  useEffect(() => {
    if (!compareOn || reference == null) {
      return;
    }
    void loadOutline(reference).then(outlineForReference => {
      // An unsynced reference (a competitor, say) opens on its own first
      // lesson rather than an empty pane.
      const lessons =
        outlineForReference?.modules.flatMap(module => module.lessons) ?? [];
      const wanted =
        refLesson != null && lessons.some(l => l.lessonId === refLesson)
          ? refLesson
          : syncOn
          ? refLesson
          : lessons[0]?.lessonId;
      if (wanted == null) {
        return;
      }
      if (wanted !== refLesson) {
        pickReferenceLesson(wanted);
        return;
      }
      if (referenceEntry == null) {
        void loadLesson(reference, wanted);
      }
    });
  }, [
    compareOn,
    reference,
    refLesson,
    referenceEntry,
    syncOn,
    loadOutline,
    loadLesson,
    pickReferenceLesson,
  ]);

  const moduleTitle = useMemo(() => {
    const module = outline?.modules.find(candidate =>
      candidate.lessons.some(lesson => lesson.lessonId === lessonId),
    );
    return module == null ? outline?.title ?? '' : `Module · ${module.title}`;
  }, [outline, lessonId]);

  const startEdit = useCallback(() => {
    if (
      version?.kind !== 'draft' ||
      version.courseId == null ||
      version.draftId == null ||
      entry?.doc == null
    ) {
      return;
    }
    beginEdit({
      courseId: version.courseId,
      draftId: version.draftId,
      versionKey: version.key,
      doc: entry.doc,
    });
  }, [version, entry, beginEdit]);

  // Editing follows the sidebar. The editor holds one lesson, and selecting
  // another used to leave that lesson on screen under the new lesson's name —
  // every lesson in a draft looked like the first one opened. Unsaved work is
  // asked about before it goes; a refusal snaps the selection back.
  const resumeEditFor = useRef<string | null>(null);
  useEffect(() => {
    if (
      !editing ||
      editLessonId == null ||
      lessonId == null ||
      lessonId === editLessonId
    ) {
      return;
    }
    if (
      editChanges > 0 &&
      !window.confirm(
        `Discard ${editChanges} unsaved change${
          editChanges === 1 ? '' : 's'
        } and edit the other lesson?`,
      )
    ) {
      selectLessonId(editLessonId);
      return;
    }
    resumeEditFor.current = lessonId;
    cancelEdit();
  }, [
    editing,
    editLessonId,
    lessonId,
    editChanges,
    cancelEdit,
    selectLessonId,
  ]);

  useEffect(() => {
    if (
      resumeEditFor.current != null &&
      resumeEditFor.current === lessonId &&
      !editing &&
      entry?.doc?.lesson.lessonId === lessonId
    ) {
      resumeEditFor.current = null;
      startEdit();
    }
  }, [editing, lessonId, entry, startEdit]);

  // Both dialogs need the next free version number before they open.
  const openVersionModal = useCallback(
    async (kind: 'save-as' | 'duplicate') => {
      if (courseId == null || version == null) {
        return;
      }
      setModalError(null);
      try {
        const { suggested } = await adminApi.nextVersion(
          courseId,
          version.version,
        );
        setSuggestedVersion(suggested);
      } catch {
        setSuggestedVersion(version.version);
      }
      openModal({ kind });
    },
    [courseId, version, openModal],
  );

  const createDraft = useCallback(
    async (label: string) => {
      if (courseId == null || version == null) {
        return;
      }
      setModalBusy(true);
      setModalError(null);
      try {
        const base =
          version.kind === 'draft'
            ? version.baseVersion ?? ''
            : version.version;
        const draft = await adminApi.createDraft(courseId, base, label);
        // Carry the open edits into the new draft, then leave edit mode.
        if (modal?.kind === 'save-as' && editDoc != null && lessonId != null) {
          await adminApi.saveDraftLesson(
            courseId,
            draft.draftId,
            lessonId,
            editDoc,
          );
        }
        cancelEdit();
        closeModal();
        const next = await reloadVersions();
        const created = next.find(item => item.draftId === draft.draftId);
        if (created != null) {
          selectVersion(created.key);
        }
        showToast(`Draft v${draft.versionLabel} created from v${base}`);
      } catch (error) {
        setModalError((error as Error).message);
      } finally {
        setModalBusy(false);
      }
    },
    [
      courseId,
      version,
      modal,
      editDoc,
      lessonId,
      cancelEdit,
      closeModal,
      reloadVersions,
      selectVersion,
      showToast,
    ],
  );

  const saveInPlace = useCallback(async () => {
    const ok = await saveEdit();
    if (!ok) {
      showToast('Could not save — check the server log');
      return;
    }
    if (version != null) {
      invalidate(version.key);
      void loadOutline(version);
      if (lessonId != null) {
        void loadLesson(version, lessonId);
      }
      showToast(`Saved to ${version.label}`);
    }
  }, [
    saveEdit,
    version,
    invalidate,
    loadOutline,
    loadLesson,
    lessonId,
    showToast,
  ]);

  // Right-clicking a selection inside the viewer offers to collect it.
  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const selection = window.getSelection()?.toString().trim() ?? '';
      if (selection.length === 0) {
        return;
      }
      event.preventDefault();
      openContextMenu({
        ...menuPosition(event.clientX, event.clientY, {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
        text: selection,
        // Read now, while the selection still exists.
        anchor: anchorOfSelection(window.getSelection()),
      });
    },
    [openContextMenu],
  );

  const contextMenu = useUi(state => state.contextMenu);
  const collectExcerpt = useCallback(
    (text: string) => {
      const anchor = contextMenu?.anchor ?? null;
      addChunk({
        text,
        source: `${version?.label ?? ''} · ${entry?.rendered.title ?? ''}`,
        note: '',
        anchor,
      });
      setRightDock('prompt');
      showToast(
        anchor == null
          ? 'Added to prompt'
          : `Added to prompt · ${describeAnchor(anchor)}`,
      );
    },
    [addChunk, contextMenu, version, entry, setRightDock, showToast],
  );

  // Which course the search runs against, in the shape the API expects.
  const similarTarget = useMemo((): SimilarTarget | null => {
    if (reference == null) {
      return null;
    }
    if (reference.kind === 'competitor') {
      return { kind: 'competitor', competitorId: reference.competitorId! };
    }
    if (reference.kind === 'draft') {
      return {
        kind: 'draft',
        courseId: reference.courseId!,
        draftId: reference.draftId!,
      };
    }
    return {
      kind: 'released',
      courseId: reference.courseId!,
      version: reference.version,
    };
  }, [reference]);

  // The toolbar button searches the current selection, or the whole lesson
  // when nothing is selected.
  const findSimilar = useCallback(
    (explicit?: string) => {
      if (similarTarget == null) {
        showToast('Turn on Compare to search a reference course');
        return;
      }
      const selection =
        explicit ?? window.getSelection()?.toString().trim() ?? '';
      const query =
        selection.length > 0
          ? selection
          : (entry?.rendered.cards ?? [])
              .map(card => [card.title, ...card.bodies].join(' '))
              .join(' ');
      if (query.trim().length === 0) {
        return;
      }
      setRightDock('similar');
      void runSimilar(query, similarTarget);
    },
    [similarTarget, entry, setRightDock, runSimilar, showToast],
  );

  const formatsMatch =
    reference == null || version == null || reference.format === version.format;
  const comparing = compareOn && reference != null;
  // The diff only makes sense while both panes show the same lesson.
  const diffActive = comparing && diffOn && formatsMatch && syncOn;

  const compare = useMemo(() => {
    if (!comparing || entry == null) {
      return null;
    }
    return buildCompare(
      entry.rendered.cards,
      referenceEntry?.rendered.cards ?? [],
      diffActive,
    );
  }, [comparing, entry, referenceEntry, diffActive]);

  return (
    <Layout>
      <VersionsSidebar />
      <LessonsColumn
        version={version}
        onEditModuleTest={(moduleId, title, questionIds) =>
          setModuleTest({ moduleId, title, questionIds })
        }
      />

      <Viewer onContextMenu={onContextMenu}>
        <ViewerToolbar
          version={version}
          reference={reference}
          moduleTitle={moduleTitle}
          lessonTitle={entry?.rendered.title ?? '—'}
          formatsMatch={formatsMatch}
          diffStats={diffActive ? compare?.stats ?? null : null}
          artworkChanges={diffActive ? compare?.artworkChanges ?? 0 : 0}
          onEdit={editing ? undefined : startEdit}
          onDuplicate={() => void openVersionModal('duplicate')}
          onFindSimilar={() => findSimilar()}
          onRelease={
            version?.kind === 'draft'
              ? () => openModal({ kind: 'release' })
              : undefined
          }
          onPublish={
            version?.kind === 'released'
              ? () => openModal({ kind: 'publish', version: version.version })
              : undefined
          }
        />

        <Scroll>
          {entry == null ? (
            <Empty>
              {loadFailure ??
                (lessonId == null
                  ? 'Select a lesson to preview its content'
                  : 'Loading…')}
            </Empty>
          ) : editing && editDoc != null && mode === 'text' ? (
            <EditCardList
              doc={editDoc}
              stateLabel={outline?.state ?? 'State'}
              cardStyles={outline?.cardStyles ?? []}
              onManageTypes={() => openModal({ kind: 'slide-types' })}
            />
          ) : mode === 'phone' && version != null ? (
            <PhoneModeView
              version={version}
              entry={
                editing && editDoc != null
                  ? {
                      doc: editDoc,
                      rendered: renderCardsFromLessonDoc(
                        editDoc,
                        outline?.state ?? 'State',
                        outline?.cardStyles,
                      ),
                    }
                  : entry
              }
              stateLabel={outline?.state ?? 'State'}
              cardStyles={outline?.cardStyles}
              reference={reference}
              referenceEntry={referenceEntry}
              referenceStateLabel={referenceOutline?.state}
              referenceCardStyles={referenceOutline?.cardStyles}
              diffRows={diffActive ? compare?.rows ?? null : null}
              editing={editing && version?.kind === 'draft'}
              referenceControls={
                reference == null ? null : (
                  <ReferencePicker
                    compact
                    current={reference}
                    options={all.filter(item => item.key !== reference.key)}
                    showLessonPicker={!syncOn}
                  />
                )
              }
            />
          ) : comparing &&
            compare != null &&
            reference != null &&
            version != null ? (
            <>
              <CompareHeaderRow
                left={version}
                right={reference}
                options={all.filter(item => item.key !== reference.key)}
                leftLesson={entry.rendered.title}
              />
              <CompareTextView
                rows={compare.rows}
                leftLabel={version.label}
                rightLabel={reference.label}
                leftLessonId={entry.rendered.lessonId}
                {...(referenceEntry != null && {
                  rightLessonId: referenceEntry.rendered.lessonId,
                })}
                leftAbsentNote={
                  syncOn && referenceEntry == null
                    ? `This lesson does not exist in ${reference.label} — everything in ${version.label} is new.`
                    : null
                }
              />
            </>
          ) : (
            <SingleTextView
              lesson={entry.rendered}
              meta={[
                `${entry.rendered.cards.length} cards`,
                version == null ? null : formatLabel(version.format),
                version?.label,
              ]
                .filter(Boolean)
                .join(' · ')}
              origins={origins}
              busy={skeletonSaving}
              onRevert={async bareId => {
                if (await revertShared(usStateCode, bareId)) {
                  setOrigins(await adminApi.stateOrigins(usStateCode));
                  showToast(`${bareId} follows the shared card again`);
                }
              }}
              onPromote={async bareId => {
                if (await promoteShared(usStateCode, 'card', bareId)) {
                  setOrigins(await adminApi.stateOrigins(usStateCode));
                  showToast(`${bareId} is now the shared text in every state`);
                }
              }}
            />
          )}
        </Scroll>

        {editing && version != null && (
          <EditFooterBar
            versionLabel={version.label}
            onDiscard={cancelEdit}
            onSave={() => void saveInPlace()}
            onSaveAsNew={() => void openVersionModal('save-as')}
          />
        )}
      </Viewer>

      {rightDock === 'prompt' && (
        <PromptPanel
          context={{
            courseTitle: settings?.courseName ?? outline?.title ?? 'Course',
            usState: stateOfCourse(courses, courseId),
            versionLabel: version?.label ?? '',
          }}
        />
      )}

      {rightDock === 'similar' && reference != null && (
        <SimilarPanel
          referenceLabel={reference.name ?? reference.label}
          onOpen={(lesson, cardIndex) => {
            pickReferenceLesson(lesson, cardIndex);
            showToast(`Opened “${lesson}” · card ${cardIndex + 1}`);
          }}
        />
      )}

      <ContextMenu
        canFindSimilar={comparing}
        onAddToPrompt={collectExcerpt}
        onFindSimilar={text => findSimilar(text)}
      />

      {moduleTest != null &&
        version?.courseId != null &&
        version.draftId != null && (
          <ModuleTestEditor
            courseId={version.courseId}
            draftId={version.draftId}
            moduleId={moduleTest.moduleId}
            moduleTitle={moduleTest.title}
            selected={moduleTest.questionIds}
            onClose={() => setModuleTest(null)}
            onSaved={() => {
              setModuleTest(null);
              invalidate(version.key);
              void loadOutline(version);
              showToast('Module test updated');
            }}
          />
        )}

      {modal?.kind === 'release' &&
        version?.courseId != null &&
        version.draftId != null && (
          <ReleaseModal
            courseId={version.courseId}
            draftId={version.draftId}
            draftLabel={version.label}
            requireNote={settings?.requireChangeNote ?? false}
            onClose={closeModal}
            onReleased={async released => {
              closeModal();
              cancelEdit();
              const next = await reloadVersions();
              const target = next.find(
                item => item.kind === 'released' && item.version === released,
              );
              if (target != null) {
                selectVersion(target.key);
              }
              showToast(`Released v${released}`);
            }}
          />
        )}

      {modal?.kind === 'slide-types' &&
        version?.courseId != null &&
        version.draftId != null && (
          <SlideTypesModal
            courseId={version.courseId}
            draftId={version.draftId}
            cardStyles={outline?.cardStyles ?? []}
            onClose={closeModal}
            onSaved={() => {
              closeModal();
              // Every cached card was rendered with the old styles, so the
              // version's documents are refetched. The open edit lives in the
              // edit store and is untouched by this.
              invalidate(version.key);
              void loadOutline(version);
              if (lessonId != null) {
                void loadLesson(version, lessonId);
              }
              showToast('Slide types saved');
            }}
          />
        )}

      {modal?.kind === 'publish' && courseId != null && (
        <PublishModal
          courseId={courseId}
          version={modal.version}
          channels={channels ?? { staging: null, production: null }}
          onClose={closeModal}
          onPublished={move => {
            showToast(
              `${
                move.channel === 'production' ? 'Production' : 'Staging'
              } now serves v${move.to}`,
            );
            void reloadVersions();
            void refreshCourses();
          }}
        />
      )}

      {modal?.kind === 'save-as' && version != null && (
        <VersionModal
          title="Save as new version"
          subtitle={`Your edits are saved into a brand-new draft. ${version.label} stays untouched.`}
          note={`Created as a draft · based on ${version.label}`}
          hint={`Suggested next free number: ${suggestedVersion}`}
          confirmLabel="Create draft"
          initialValue={suggestedVersion}
          busy={modalBusy}
          error={modalError}
          onConfirm={label => void createDraft(label)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'duplicate' && version != null && (
        <VersionModal
          title={`Duplicate ${version.label} as draft`}
          subtitle={`Creates an editable draft with the full module tree and content of ${version.label}. The release itself stays immutable.`}
          note={`Created as a draft · based on ${version.label}`}
          hint={`Suggested next free number: ${suggestedVersion}`}
          confirmLabel="Create draft"
          initialValue={suggestedVersion}
          busy={modalBusy}
          error={modalError}
          onConfirm={label => void createDraft(label)}
          onClose={closeModal}
        />
      )}
    </Layout>
  );
};

export default CourseEditorScreen;

const Layout = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
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

const Empty = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: ${admin.dim2};
`;
