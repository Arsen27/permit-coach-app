import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import type { CardStyleV2 } from '@/data/course/v2/wire';
import { Chip, Dot, Mono } from '@admin/features/shell/ui';
import type { CompareRow } from '@admin/model/compare';
import type { LessonEntry } from '@admin/store/docsStore';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import { statusOf } from '@admin/model/versionDescriptor';
import { useSelection } from '@admin/store/selectionStore';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

import AppLessonScreen from './AppLessonScreen';
import CompetitorLessonScreen, {
  competitorPageCount,
} from './CompetitorLessonScreen';
import PhoneRichScreen from './PhoneRichScreen';
import IOSChrome, {
  DEVICE_HEIGHT,
  DEVICE_WIDTH,
  FRAME_HEIGHT,
  FRAME_WIDTH,
} from './IOSChrome';

// One or two simulated phones. Both run the app's own lesson renderer, so the
// preview is the product rather than a drawing of it.

const pageCountOf = (
  entry: LessonEntry | undefined,
  version: VersionDescriptor,
): number =>
  entry == null
    ? 0
    : entry.competitor != null
    ? competitorPageCount(
        entry.competitor,
        version.format === 'slides' ? 'slides' : 'article',
      )
    : entry.rendered.source.length;

// Diff marks and contentEditable need web markup, which the RN renderer
// cannot carry — those two modes swap the screen for PhoneRichScreen.
type RichMode =
  | { kind: 'edit' }
  | { kind: 'diff'; row: CompareRow | null; side: 'before' | 'after' }
  | null;

type PhoneProps = {
  version: VersionDescriptor;
  entry: LessonEntry | undefined;
  stateLabel: string;
  cardStyles?: CardStyleV2[];
  index: number;
  scale: number;
  onIndex: (index: number) => void;
  showPager: boolean;
  simIndex: number;
  focused: boolean;
  rich?: RichMode;
  totalOverride?: number;
  children?: React.ReactNode;
};

const EMPTY_RENDERED = {
  lessonId: '',
  title: '—',
  cards: [],
  source: [],
};

const Phone: React.FC<PhoneProps> = ({
  version,
  entry,
  stateLabel,
  cardStyles,
  index,
  scale,
  onIndex,
  showPager,
  simIndex,
  focused,
  rich = null,
  totalOverride,
  children,
}) => {
  const status = admin.status[statusOf(version)];
  const total = totalOverride ?? pageCountOf(entry, version);
  const bounded = total === 0 ? 0 : Math.min(index, total - 1);

  return (
    <Column>
      <Caption>
        <Dot $color={status.dot} />
        <Mono $size={11.5} $weight={700}>
          {version.label}
        </Mono>
        <Chip $color={status.col} $bg={status.bg}>
          {status.chip}
        </Chip>
        <CaptionLesson>· {entry?.rendered.title ?? '—'}</CaptionLesson>
      </Caption>

      {children}

      <Viewport
        data-sim-index={simIndex}
        data-sim-focused={focused}
        title={focused ? undefined : 'Click to scroll inside the phone'}
        style={{
          width: Math.round(FRAME_WIDTH * scale),
          height: Math.round(FRAME_HEIGHT * scale),
        }}
      >
        <Scaler style={{ transform: `scale(${scale})` }}>
          <IOSChrome focused={focused}>
            {rich != null ? (
              <PhoneRichScreen
                rendered={entry?.rendered ?? EMPTY_RENDERED}
                index={bounded}
                row={rich.kind === 'diff' ? rich.row : null}
                side={rich.kind === 'diff' ? rich.side : 'after'}
                editable={rich.kind === 'edit'}
                onAdvance={() => onIndex(Math.min(bounded + 1, total - 1))}
              />
            ) : entry == null ? (
              <Missing>Not in this version</Missing>
            ) : entry.competitor != null ? (
              <CompetitorLessonScreen
                lesson={entry.competitor}
                style={version.format === 'slides' ? 'slides' : 'article'}
                index={bounded}
                scrollEnabled={focused}
                onAdvance={() => onIndex(Math.min(bounded + 1, total - 1))}
              />
            ) : entry.doc != null ? (
              <AppLessonScreen
                doc={entry.doc}
                cards={entry.rendered.source}
                index={bounded}
                stateLabel={stateLabel}
                cardStyles={cardStyles}
                scrollEnabled={focused}
                onAdvance={() => onIndex(Math.min(bounded + 1, total - 1))}
              />
            ) : null}
          </IOSChrome>
        </Scaler>
      </Viewport>

      {showPager && total > 0 && (
        <Pager>
          <PagerButton
            disabled={bounded === 0}
            onClick={() => onIndex(bounded - 1)}
          >
            ‹
          </PagerButton>
          <Mono $size={11} $weight={600}>
            {bounded + 1} / {total}
          </Mono>
          <PagerButton
            disabled={bounded >= total - 1}
            onClick={() => onIndex(bounded + 1)}
          >
            ›
          </PagerButton>
        </Pager>
      )}
    </Column>
  );
};

type Props = {
  version: VersionDescriptor;
  entry: LessonEntry | undefined;
  stateLabel: string;
  cardStyles?: CardStyleV2[];
  reference?: VersionDescriptor | null;
  referenceEntry?: LessonEntry | undefined;
  referenceStateLabel?: string;
  referenceCardStyles?: CardStyleV2[];
  referenceControls?: React.ReactNode;
  // Compare rows while the diff is active — both phones render marked runs.
  diffRows?: CompareRow[] | null;
  // Draft editing: phone A becomes contentEditable.
  editing?: boolean;
};

const PhoneModeView: React.FC<Props> = ({
  version,
  entry,
  stateLabel,
  cardStyles,
  reference,
  referenceEntry,
  referenceStateLabel,
  referenceCardStyles,
  referenceControls,
  diffRows = null,
  editing = false,
}) => {
  // Which device owns the wheel. Until one is clicked, the page scrolls as
  // usual; clicking anywhere outside a phone hands scrolling back to it.
  const [focusedSim, setFocusedSim] = useState<number | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const sim = target?.closest?.('[data-sim-index]');
      setFocusedSim(
        sim == null
          ? null
          : Number((sim as HTMLElement).dataset.simIndex ?? '0'),
      );
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const scale = useUi(state => state.phoneScale);
  const setScale = useUi(state => state.setPhoneScale);
  const indexA = useSelection(state => state.phoneIndexA);
  const indexB = useSelection(state => state.phoneIndexB);
  const setIndexA = useSelection(state => state.setPhoneIndexA);
  const setIndexB = useSelection(state => state.setPhoneIndexB);
  const syncOn = useSelection(state => state.syncOn);
  const compareOn = useSelection(state => state.compareOn);

  const comparing = compareOn && reference != null;
  // While synced both phones step together, so one pager drives both.
  const synced = comparing && syncOn;
  // Our courses page by card; competitor captures page by section.
  // Editing outranks diffing: an editable card cannot carry marked runs.
  const richA: RichMode = editing
    ? { kind: 'edit' }
    : diffRows != null
    ? { kind: 'diff', row: null, side: 'after' }
    : null;
  const total =
    !editing && diffRows != null
      ? diffRows.length
      : pageCountOf(entry, version);
  const bounded = total === 0 ? 0 : Math.min(indexA, total - 1);

  const step = (next: number) => {
    setIndexA(next);
    if (synced) {
      setIndexB(next);
    }
  };

  // Arrow keys page the focused phone: the synced pair moves together, an
  // unsynced reference phone pages on its own. Without focus the keyboard
  // stays with the page, same as the wheel.
  useEffect(() => {
    if (focusedSim == null) {
      return;
    }
    const referenceTotal =
      reference == null ? 0 : pageCountOf(referenceEntry, reference);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target != null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;

      if (focusedSim === 1 && comparing && !synced) {
        const current =
          referenceTotal === 0 ? 0 : Math.min(indexB, referenceTotal - 1);
        setIndexB(Math.max(0, Math.min(current + delta, referenceTotal - 1)));
        return;
      }
      const current = total === 0 ? 0 : Math.min(indexA, total - 1);
      step(Math.max(0, Math.min(current + delta, total - 1)));
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  return (
    <Wrap>
      <Phones>
        <Phone
          version={version}
          entry={entry}
          stateLabel={stateLabel}
          cardStyles={cardStyles}
          index={indexA}
          scale={scale}
          onIndex={step}
          showPager={!synced}
          simIndex={0}
          focused={focusedSim === 0}
          rich={
            richA?.kind === 'diff'
              ? {
                  kind: 'diff',
                  row: diffRows?.[bounded] ?? null,
                  side: 'after',
                }
              : richA
          }
          totalOverride={
            !editing && diffRows != null ? diffRows.length : undefined
          }
        />
        {comparing && (
          <Phone
            version={reference}
            entry={referenceEntry}
            stateLabel={referenceStateLabel ?? stateLabel}
            cardStyles={referenceCardStyles ?? cardStyles}
            index={synced ? indexA : indexB}
            scale={scale}
            onIndex={synced ? step : setIndexB}
            showPager={!synced}
            simIndex={1}
            focused={focusedSim === 1}
            rich={
              !editing && diffRows != null
                ? {
                    kind: 'diff',
                    row: diffRows[synced ? bounded : indexB] ?? null,
                    side: 'before',
                  }
                : null
            }
            totalOverride={
              !editing && diffRows != null ? diffRows.length : undefined
            }
          >
            {referenceControls}
          </Phone>
        )}
      </Phones>

      <Controls>
        {synced && total > 0 && (
          <>
            <PagerButton
              disabled={bounded === 0}
              onClick={() => step(bounded - 1)}
            >
              ‹
            </PagerButton>
            <Mono $size={12} $weight={600}>
              Card {bounded + 1} of {total}
            </Mono>
            <PagerButton
              disabled={bounded >= total - 1}
              onClick={() => step(bounded + 1)}
            >
              ›
            </PagerButton>
            <ControlDivider />
          </>
        )}
        <SizeLabel>SIZE</SizeLabel>
        <Slider
          type="range"
          min={45}
          max={90}
          value={Math.round(scale * 100)}
          onChange={event => setScale(Number(event.target.value) / 100)}
        />
        <Mono $size={11} $weight={600}>
          {Math.round(scale * 100)}%
        </Mono>
      </Controls>
    </Wrap>
  );
};

export default PhoneModeView;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Phones = styled.div`
  display: flex;
  gap: 44px;
  align-items: flex-end;
  flex-wrap: wrap;
  justify-content: center;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
`;

const Caption = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  color: ${admin.body};
`;

const CaptionLesson = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${admin.dim};
  max-width: 240px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// No overflow clipping: the child is transform-scaled to fit exactly, and
// clipping would square off the bezel's soft drop shadow into a grey slab
// behind the phone.
const Viewport = styled.div``;

const Scaler = styled.div`
  width: ${FRAME_WIDTH}px;
  height: ${FRAME_HEIGHT}px;
  transform-origin: 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${(FRAME_HEIGHT - DEVICE_HEIGHT) / 2}px
    ${(FRAME_WIDTH - DEVICE_WIDTH) / 2}px;
  box-sizing: border-box;
`;

const Missing = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: ${admin.dim2};
`;

const Pager = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${admin.muted};
`;

const PagerButton = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 99px;
  background: ${admin.surface};
  border: 1px solid ${admin.line};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  color: ${admin.muted};

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:hover:not(:disabled) {
    background: ${admin.hair};
  }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
  color: ${admin.dim};
`;

const ControlDivider = styled.div`
  width: 1px;
  height: 18px;
  background: ${admin.line};
  margin: 0 4px;
`;

const SizeLabel = styled.span`
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.7px;
  color: ${admin.dim2};
`;

const Slider = styled.input`
  width: 130px;
  accent-color: ${admin.accent};
`;
