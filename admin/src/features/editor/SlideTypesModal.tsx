import React, { useMemo, useState } from 'react';
import styled from 'styled-components';

import { iconXml } from '@/assets/icons';
import { CARD_META } from '@/components/lesson/cards';
import type { CardStyleV2, CardToneV2 } from '@/data/course/v2/wire';
import {
  MAX_CARD_STYLES_SVG_BYTES,
  MAX_ICON_SVG_BYTES,
  cardStylesSvgBytes,
  utf8Length,
} from '@/data/course/v2/wire';
import { adminApi } from '@admin/api/adminApi';
import {
  followsCurrentColor,
  paintsItself,
  readUploadedIcon,
  tintedIcon,
} from '@admin/model/svg';
import { PrimaryButton } from '@admin/features/shell/ui';
import { toneColor } from '@admin/features/viewer/CardView';
import {
  BUILT_IN_STYLE_IDS,
  slideTypesOf,
  type SlideType,
} from '@admin/model/slides';
import { admin } from '@admin/styles/theme';

// The course's slide types. A built-in family is always listed — overriding one
// retitles or recolours every card of that family at once — and a course may
// add types of its own for blocks to opt into. Nothing here changes what a
// slide *does*; that is the slide's kind, edited on the slide itself.

type Props = {
  courseId: string;
  draftId: string;
  cardStyles: CardStyleV2[];
  onClose: () => void;
  onSaved: (cardStyles: CardStyleV2[]) => void;
};

const TONES: CardToneV2[] = ['accent', 'muted', 'trap', 'california'];
const ICONS = Object.keys(iconXml);

const slugify = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

// A row is only written back when it actually differs from the built-in, so an
// untouched course keeps shipping no `cardStyles` at all.
const differsFromBuiltIn = (row: SlideType): boolean => {
  if (!row.builtIn) {
    return true;
  }
  const base =
    row.styleId === 'checkpoint'
      ? CARD_META.core_rule
      : CARD_META[row.styleId as keyof typeof CARD_META];
  return (
    row.label !== base.label ||
    row.icon !== base.icon ||
    row.iconSvg != null ||
    row.tone !== base.tone ||
    row.textColor != null ||
    row.iconColor != null
  );
};

const toStyle = (row: SlideType): CardStyleV2 => ({
  styleId: row.styleId,
  label: row.label,
  icon: row.icon,
  ...(row.iconSvg != null && { iconSvg: row.iconSvg }),
  tone: row.tone as CardToneV2,
  ...(row.textColor != null && { textColor: row.textColor }),
  ...(row.iconColor != null && { iconColor: row.iconColor }),
});

const SlideTypesModal: React.FC<Props> = ({
  courseId,
  draftId,
  cardStyles,
  onClose,
  onSaved,
}) => {
  const [rows, setRows] = useState<SlideType[]>(() => slideTypesOf(cardStyles));
  // Types added in this session only. Their id still follows the name, because
  // no block can be pointing at it yet; a saved type's id is frozen.
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (styleId: string, change: Partial<SlideType>) =>
    setRows(current =>
      current.map(row =>
        row.styleId === styleId ? { ...row, ...change } : row,
      ),
    );

  const taken = useMemo(
    () => new Set([...rows.map(row => row.styleId), ...BUILT_IN_STYLE_IDS]),
    [rows],
  );

  const freeId = (base: string, used: Set<string>): string => {
    const seed = slugify(base) || 'slide_type';
    let styleId = seed;
    let n = 2;
    while (used.has(styleId)) {
      styleId = `${seed}_${n}`;
      n += 1;
    }
    return styleId;
  };

  const rename = (row: SlideType, label: string) => {
    if (!fresh.has(row.styleId)) {
      patch(row.styleId, { label });
      return;
    }
    const used = new Set(taken);
    used.delete(row.styleId);
    const styleId = freeId(label, used);
    setRows(current =>
      current.map(item =>
        item.styleId === row.styleId ? { ...item, label, styleId } : item,
      ),
    );
    setFresh(current => {
      const next = new Set(current);
      next.delete(row.styleId);
      next.add(styleId);
      return next;
    });
  };

  // One hidden input serves every row; the pending id says which row asked.
  const filePick = React.useRef<HTMLInputElement>(null);
  const pendingRow = React.useRef<string | null>(null);
  // Each type's glyph as it was drawn, before any recolouring. Kept for this
  // sitting only — the course ships one glyph per type, not two — so that a
  // type can be flipped back to its own colours without a re-upload.
  const [asDrawn, setAsDrawn] = useState<Record<string, string>>({});

  const remember = (styleId: string, svgXml: string | undefined) =>
    setAsDrawn(current => {
      const next = { ...current };
      if (svgXml == null) {
        delete next[styleId];
      } else {
        next[styleId] = svgXml;
      }
      return next;
    });

  const chooseIcon = (styleId: string) => {
    pendingRow.current = styleId;
    filePick.current?.click();
  };

  const onIconFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const styleId = pendingRow.current;
    event.target.value = '';
    pendingRow.current = null;
    if (file == null || styleId == null) {
      return;
    }
    try {
      const drawn = await readUploadedIcon(file);
      // Replacing a glyph keeps the type's tint choice; a first upload is
      // tinted, which is the look every built-in type already has.
      const previous = rows.find(row => row.styleId === styleId)?.iconSvg;
      const iconSvg = tintedIcon(
        drawn,
        previous == null || followsCurrentColor(previous),
      );
      const bytes = utf8Length(iconSvg);
      if (bytes > MAX_ICON_SVG_BYTES) {
        throw new Error(
          `that glyph is ${bytes} bytes — the limit is ${MAX_ICON_SVG_BYTES}. Simplify it, or export it without embedded images.`,
        );
      }
      setError(null);
      remember(styleId, drawn);
      patch(styleId, { iconSvg });
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  // The tint switch, per slide type. Recolouring is always on offer; going back
  // to the drawn colours needs the glyph as it arrived, which is why it is kept.
  const setTinted = (row: SlideType, tinted: boolean) => {
    const drawn = asDrawn[row.styleId] ?? row.iconSvg;
    if (drawn == null) {
      return;
    }
    remember(row.styleId, drawn);
    patch(row.styleId, { iconSvg: tintedIcon(drawn, tinted) });
  };

  const addType = () => {
    const styleId = freeId('New slide type', taken);
    setRows(current => [
      ...current,
      {
        styleId,
        label: 'New slide type',
        icon: 'book-open',
        tone: 'muted',
        builtIn: false,
        authored: true,
      },
    ]);
    setFresh(current => new Set(current).add(styleId));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = rows.filter(differsFromBuiltIn).map(toStyle);
      await adminApi.saveCardStyles(courseId, draftId, next);
      onSaved(next);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (row: SlideType) => {
    const color = row.textColor ?? toneColor(row.tone);
    const icon = row.iconColor ?? color;
    // Built-in glyphs always follow the type's colour; an uploaded one may keep
    // the colours it was drawn with — that is this type's choice alone.
    const tinted = row.iconSvg == null || followsCurrentColor(row.iconSvg);
    const drawn = asDrawn[row.styleId] ?? row.iconSvg;
    const ownColours =
      drawn != null && !followsCurrentColor(drawn) && paintsItself(drawn);
    return (
      <Row key={row.styleId}>
        <Preview>
          <IconSlot
            $color={icon}
            dangerouslySetInnerHTML={{
              __html:
                row.iconSvg ?? iconXml[row.icon as keyof typeof iconXml] ?? '',
            }}
          />
          <PreviewLabel $color={color}>{row.label}</PreviewLabel>
        </Preview>

        <Fields>
          <Label>
            Label
            <Input
              value={row.label}
              onChange={event => rename(row, event.target.value)}
            />
          </Label>

          <Label>
            Icon
            {row.iconSvg == null ? (
              <IconField>
                <Picker
                  value={row.icon}
                  onChange={event =>
                    patch(row.styleId, { icon: event.target.value })
                  }
                >
                  {ICONS.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Picker>
                <Clear
                  title="Upload an SVG glyph — it ships with the course, so no app release is needed"
                  onClick={() => chooseIcon(row.styleId)}
                >
                  Upload…
                </Clear>
              </IconField>
            ) : (
              <IconField>
                <Uploaded title={`${utf8Length(row.iconSvg)} bytes`}>
                  {utf8Length(row.iconSvg)} B
                </Uploaded>
                <Clear
                  title="Replace the uploaded glyph"
                  onClick={() => chooseIcon(row.styleId)}
                >
                  Replace…
                </Clear>
                <Clear
                  title="Go back to a built-in icon"
                  onClick={() => {
                    remember(row.styleId, undefined);
                    patch(row.styleId, { iconSvg: undefined });
                  }}
                >
                  ✕
                </Clear>
              </IconField>
            )}
          </Label>

          {row.iconSvg != null && (
            <Label
              title={
                ownColours
                  ? 'Whether this type’s glyph is recoloured — every other type keeps its own answer'
                  : 'The colours this glyph was drawn with are no longer here — upload it again to keep them'
              }
            >
              Glyph
              <Picker
                value={tinted ? 'tint' : 'own'}
                onChange={event =>
                  setTinted(row, event.target.value === 'tint')
                }
              >
                <option value="tint">Follow type</option>
                <option value="own" disabled={!ownColours}>
                  As drawn
                </option>
              </Picker>
            </Label>
          )}

          <Label>
            Tone
            <Picker
              value={row.tone}
              title="The palette slot used when no explicit colour is set"
              onChange={event =>
                patch(row.styleId, { tone: event.target.value })
              }
            >
              {TONES.map(tone => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </Picker>
          </Label>

          <Label>
            Text
            <ColorField>
              <Color
                type="color"
                value={row.textColor ?? toneColor(row.tone)}
                onChange={event =>
                  patch(row.styleId, { textColor: event.target.value })
                }
              />
              {row.textColor != null && (
                <Clear
                  title="Back to the tone colour"
                  onClick={() => patch(row.styleId, { textColor: undefined })}
                >
                  ✕
                </Clear>
              )}
            </ColorField>
          </Label>

          <Label>
            {row.iconSvg != null && !followsCurrentColor(row.iconSvg)
              ? 'Icon (own colours)'
              : 'Icon colour'}
            <ColorField>
              <Color
                type="color"
                disabled={
                  row.iconSvg != null && !followsCurrentColor(row.iconSvg)
                }
                title={
                  row.iconSvg != null && !followsCurrentColor(row.iconSvg)
                    ? 'This glyph paints itself — set its Glyph to “Follow type” to tint it'
                    : undefined
                }
                value={row.iconColor ?? row.textColor ?? toneColor(row.tone)}
                onChange={event =>
                  patch(row.styleId, { iconColor: event.target.value })
                }
              />
              {row.iconColor != null && (
                <Clear
                  title="Back to the text colour"
                  onClick={() => patch(row.styleId, { iconColor: undefined })}
                >
                  ✕
                </Clear>
              )}
            </ColorField>
          </Label>
        </Fields>

        <Trailing>
          <StyleId>{row.styleId}</StyleId>
          {row.builtIn ? (
            differsFromBuiltIn(row) && (
              <Clear
                title="Restore the built-in look"
                onClick={() =>
                  setRows(current =>
                    current.map(item =>
                      item.styleId === row.styleId
                        ? slideTypesOf([]).find(
                            base => base.styleId === row.styleId,
                          ) ?? item
                        : item,
                    ),
                  )
                }
              >
                Reset
              </Clear>
            )
          ) : (
            <Clear
              title="Delete this slide type"
              onClick={() =>
                setRows(current =>
                  current.filter(item => item.styleId !== row.styleId),
                )
              }
            >
              Delete
            </Clear>
          )}
        </Trailing>
      </Row>
    );
  };

  const custom = rows.filter(row => !row.builtIn);
  const builtIn = rows.filter(row => row.builtIn);
  const svgBytes = cardStylesSvgBytes(
    rows.filter(differsFromBuiltIn).map(toStyle),
  );

  return (
    <Backdrop onClick={onClose}>
      <Dialog onClick={event => event.stopPropagation()}>
        <Title>Slide types</Title>
        <Subtitle>
          The kicker above a card’s title. Editing a built-in type changes every
          card of that family across the course; your own types are opted into
          slide by slide. Saving writes straight to this draft.
        </Subtitle>

        <HiddenFile
          ref={filePick}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={event => void onIconFile(event)}
        />

        <Scroll>
          <SectionLabel>This course’s own types</SectionLabel>
          {custom.length === 0 ? (
            <Empty>None yet — add one below.</Empty>
          ) : (
            custom.map(renderRow)
          )}
          <AddButton onClick={addType}>+ Add slide type</AddButton>

          <SectionLabel>Built-in types</SectionLabel>
          {builtIn.map(renderRow)}
        </Scroll>

        {/* Glyphs ride inside the course document, which every update
            downloads whole. The cost is small, but it is paid by every
            learner on every update, so it is shown while it is incurred. */}
        <Budget $over={svgBytes > MAX_CARD_STYLES_SVG_BYTES}>
          <span>
            Icons {(svgBytes / 1024).toFixed(1)} KB of{' '}
            {Math.round(MAX_CARD_STYLES_SVG_BYTES / 1024)} KB
          </span>
          <Meter>
            <MeterFill
              $ratio={svgBytes / MAX_CARD_STYLES_SVG_BYTES}
              $over={svgBytes > MAX_CARD_STYLES_SVG_BYTES}
            />
          </Meter>
          <span>downloaded with every course update</span>
        </Budget>

        {error != null && <ErrorText>{error}</ErrorText>}

        <Actions>
          <Cancel onClick={onClose}>Cancel</Cancel>
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save slide types'}
          </PrimaryButton>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};

export default SlideTypesModal;

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
  width: 860px;
  max-width: calc(100vw - 60px);
  max-height: calc(100vh - 80px);
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
  margin: 0 0 14px;
  font-size: 12.5px;
  line-height: 1.55;
  font-weight: 500;
  color: ${admin.dim};
  text-wrap: pretty;
`;

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
`;

const SectionLabel = styled.div`
  font: 600 9px ${admin.mono};
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${admin.dim2};
  margin: 16px 0 8px;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 9px 10px;
  border: 1px solid ${admin.line3};
  border-radius: 11px;
  margin-bottom: 7px;
`;

const Preview = styled.div`
  flex: none;
  width: 168px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 5px;
`;

const IconSlot = styled.span<{ $color: string }>`
  flex: none;
  display: inline-flex;
  color: ${({ $color }) => $color};

  svg {
    width: 15px;
    height: 15px;
  }
`;

const PreviewLabel = styled.span<{ $color: string }>`
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
`;

const Fields = styled.div`
  flex: 1;
  display: flex;
  gap: 8px;
  min-width: 0;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 3px;
  font: 600 8.5px ${admin.mono};
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${admin.dim2};
  min-width: 0;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${admin.ink};
  border: 1px solid ${admin.line};
  border-radius: 7px;
  padding: 5px 7px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const Picker = styled.select`
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.ink};
  border: 1px solid ${admin.line};
  border-radius: 7px;
  padding: 5px 6px;
  max-width: 120px;
  outline: none;
`;

const ColorField = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Color = styled.input`
  width: 34px;
  height: 26px;
  padding: 0;
  border: 1px solid ${admin.line};
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
`;

const Trailing = styled.div`
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-bottom: 4px;
`;

const StyleId = styled.code`
  font: 500 9px ${admin.mono};
  color: ${admin.ghost};
`;

const Clear = styled.button`
  padding: 2px 7px;
  border: none;
  border-radius: 6px;
  background: ${admin.bg};
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  color: ${admin.dim};
  cursor: pointer;

  &:hover {
    background: ${admin.hair};
    color: ${admin.body};
  }
`;

const AddButton = styled.button`
  width: 100%;
  padding: 8px;
  border: 1.5px dashed ${admin.line};
  border-radius: 10px;
  background: transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  color: ${admin.dim2};
  cursor: pointer;

  &:hover {
    border-color: ${admin.accent};
    color: ${admin.accent};
  }
`;

const Empty = styled.p`
  margin: 0 0 8px;
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim};
`;

const ErrorText = styled.p`
  margin: 10px 0 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #b91c1c;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 16px;
`;

const Cancel = styled.button`
  padding: 8px 14px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  color: ${admin.dim};
  cursor: pointer;

  &:hover {
    background: ${admin.bg};
  }
`;

const IconField = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Uploaded = styled.span`
  flex: none;
  padding: 4px 7px;
  border: 1px solid ${admin.line};
  border-radius: 7px;
  font: 600 10px ${admin.mono};
  color: ${admin.dim};
`;

const HiddenFile = styled.input`
  display: none;
`;

const Budget = styled.div<{ $over: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $over }) => ($over ? '#B91C1C' : admin.dim)};
`;

const Meter = styled.div`
  flex: 1;
  height: 4px;
  border-radius: 4px;
  background: ${admin.line};
  overflow: hidden;
`;

const MeterFill = styled.div<{ $ratio: number; $over: boolean }>`
  height: 100%;
  width: ${({ $ratio }) => Math.min(100, Math.round($ratio * 100))}%;
  background: ${({ $over }) => ($over ? '#B91C1C' : admin.accent)};
`;
