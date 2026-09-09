import React from 'react';
import styled from 'styled-components';

import type { CourseAssetV2, LessonElementV2 } from '@/data/course/v2/wire';
import { bodyRows, type BodyRow } from '@admin/model/slides';
import { useEdit } from '@admin/store/editStore';
import { admin } from '@admin/styles/theme';
import { assetSrc } from '@admin/model/svg';

import RowMenu, { type RowMenuState } from './RowMenu';
import { AutoGrow, FieldLabel, SmallButton, SmallInput } from './fields';

// A slide's body, one line per row. A row is grabbed by the handle on its left
// and dropped between any other two; the ✕ on the right removes it, and so does
// the right-click menu. Adding is a single bar under the list rather than a set
// of controls between every pair of lines — one place to look, not N.

// What the caller's single hidden file input should do with the chosen SVG.
export type ImagePick =
  | { kind: 'insert'; blockId: string; index: number }
  | { kind: 'replace'; assetId: string }
  // A question's own illustration, which belongs to the question rather than
  // to any one slide's body.
  | { kind: 'question'; questionId: string }
  // The lesson screen's opening illustration.
  | { kind: 'hero' };

type Props = {
  blockId: string;
  elements: LessonElementV2[];
  assets: Map<string, CourseAssetV2>;
  // Opens the file picker; the caller owns the single hidden input.
  onPickImage: (pick: ImagePick) => void;
};

// Where a dragged row would land: before row N, or at the very end.
type DropAt = number | null;

const SlideBodyEditor: React.FC<Props> = ({
  blockId,
  elements,
  assets,
  onPickImage,
}) => {
  const editRow = useEdit(state => state.editRow);
  const addRow = useEdit(state => state.addRow);
  const removeRow = useEdit(state => state.removeRow);
  const moveRowTo = useEdit(state => state.moveRowTo);
  const setAssetAlt = useEdit(state => state.setAssetAlt);

  const rows = bodyRows(elements);

  const [dragging, setDragging] = React.useState<number | null>(null);
  const [dropAt, setDropAt] = React.useState<DropAt>(null);
  const [menu, setMenu] = React.useState<RowMenuState | null>(null);
  // A row is only draggable once its handle is pressed, so selecting text in a
  // line never starts a drag.
  const [grabbed, setGrabbed] = React.useState<number | null>(null);

  // Opening a line with Enter or closing one with Backspace has to carry the
  // caret with it, or the keyboard flow stops at the first key.
  const fields = React.useRef(new Map<number, HTMLTextAreaElement>());
  const focusNext = React.useRef<number | null>(null);

  React.useEffect(() => {
    const index = focusNext.current;
    if (index == null) {
      return;
    }
    focusNext.current = null;
    const field = fields.current.get(index);
    if (field != null) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });

  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
    setGrabbed(null);
  };

  const onDropAt = (index: number) => {
    if (dragging != null) {
      moveRowTo(blockId, dragging, index);
    }
    endDrag();
  };

  // The drop lands before this row or after it, whichever edge is nearer.
  const dropTarget = (event: React.DragEvent, index: number): number => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientY - box.top < box.height / 2 ? index : index + 1;
  };

  const rowContent = (row: BodyRow, index: number) => {
    if (row.kind === 'paragraph' || row.kind === 'bullet') {
      return (
        <Line>
          {row.kind === 'bullet' && <Mark>•</Mark>}
          <AutoGrow data-value={row.text}>
            <textarea
              ref={node => {
                if (node == null) {
                  fields.current.delete(index);
                } else {
                  fields.current.set(index, node);
                }
              }}
              rows={1}
              value={row.text}
              placeholder={row.kind === 'bullet' ? 'Bullet' : 'Write a line…'}
              onChange={event =>
                editRow(blockId, index, { ...row, text: event.target.value })
              }
              onKeyDown={event => {
                // Enter opens the next line, the way a document editor does;
                // Shift+Enter stays inside this one.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  focusNext.current = index + 1;
                  addRow(blockId, index + 1, { ...row, text: '' });
                  return;
                }
                // Backspace on an empty line removes it, so a line can be
                // taken back without reaching for the mouse.
                if (
                  event.key === 'Backspace' &&
                  row.text.length === 0 &&
                  rows.length > 1
                ) {
                  event.preventDefault();
                  focusNext.current = Math.max(0, index - 1);
                  removeRow(blockId, index);
                }
              }}
            />
          </AutoGrow>
        </Line>
      );
    }

    if (row.kind === 'image') {
      const asset = assets.get(row.assetId);
      return (
        <ImageBox>
          <ImagePreview>
            {asset != null && (
              <PreviewImage src={assetSrc(asset)} alt={asset.alt} />
            )}
          </ImagePreview>
          <ImageBar>
            <FieldLabel>IMAGE</FieldLabel>
            <SmallInput
              value={asset?.alt ?? ''}
              placeholder="Describe the illustration"
              title="Shown to screen readers and in the diff"
              onChange={event => setAssetAlt(row.assetId, event.target.value)}
            />
            <SmallButton
              title="Upload an SVG to replace this illustration"
              onClick={() =>
                onPickImage({ kind: 'replace', assetId: row.assetId })
              }
            >
              Replace
            </SmallButton>
          </ImageBar>
        </ImageBox>
      );
    }

    return (
      <Unknown>
        Element of kind “{row.element.kind}” — this panel does not know it, so
        it is kept exactly as authored.
      </Unknown>
    );
  };

  return (
    <Column
      data-body={blockId}
      onDragOver={event => {
        if (dragging != null) {
          event.preventDefault();
        }
      }}
    >
      {rows.map((row, index) => (
        <Row
          key={index}
          data-row={index}
          $dragging={dragging === index}
          draggable={grabbed === index}
          onDragStart={event => {
            setDragging(index);
            event.dataTransfer.effectAllowed = 'move';
            // Firefox needs payload set or the drag never starts.
            event.dataTransfer.setData('text/plain', String(index));
          }}
          onDragEnd={endDrag}
          onDragOver={event => {
            if (dragging == null) {
              return;
            }
            event.preventDefault();
            setDropAt(dropTarget(event, index));
          }}
          onDrop={event => {
            event.preventDefault();
            onDropAt(dropTarget(event, index));
          }}
          onContextMenu={event => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY, index });
          }}
        >
          {dropAt === index && <DropLine />}
          <Handle
            title="Drag to move this line"
            aria-label="Drag to move this line"
            onMouseDown={() => setGrabbed(index)}
            onMouseUp={() => setGrabbed(null)}
          >
            ⠿
          </Handle>
          <Fill>{rowContent(row, index)}</Fill>
          <Remove
            title="Remove this line"
            aria-label="Remove this line"
            disabled={rows.length <= 1}
            onClick={() => removeRow(blockId, index)}
          >
            ✕
          </Remove>
          {dropAt === index + 1 && index === rows.length - 1 && <DropLineEnd />}
        </Row>
      ))}

      <AddBar
        onDragOver={event => {
          if (dragging != null) {
            event.preventDefault();
            setDropAt(rows.length);
          }
        }}
        onDrop={event => {
          event.preventDefault();
          onDropAt(rows.length);
        }}
      >
        <AddButton
          title="Add a paragraph at the end"
          onClick={() =>
            addRow(blockId, rows.length, { kind: 'paragraph', text: '' })
          }
        >
          + Text
        </AddButton>
        <AddButton
          title="Add a bullet at the end"
          onClick={() =>
            addRow(blockId, rows.length, { kind: 'bullet', text: '' })
          }
        >
          + Bullets
        </AddButton>
        <AddButton
          title="Upload an SVG and place it at the end"
          onClick={() =>
            onPickImage({ kind: 'insert', blockId, index: rows.length })
          }
        >
          + Image
        </AddButton>
      </AddBar>

      {menu != null && (
        <RowMenu
          state={menu}
          canRemove={rows.length > 1}
          onClose={() => setMenu(null)}
          onInsertAbove={kind =>
            kind === 'image'
              ? onPickImage({ kind: 'insert', blockId, index: menu.index })
              : addRow(blockId, menu.index, { kind, text: '' })
          }
          onInsertBelow={kind =>
            kind === 'image'
              ? onPickImage({ kind: 'insert', blockId, index: menu.index + 1 })
              : addRow(blockId, menu.index + 1, { kind, text: '' })
          }
          onRemove={() => removeRow(blockId, menu.index)}
        />
      )}
    </Column>
  );
};

export default SlideBodyEditor;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: -20px;
`;

const Row = styled.div<{ $dragging: boolean }>`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 2px;
  border-radius: 5px;
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};

  &:hover {
    background: ${admin.soft2};
  }
`;

// The gutter is always reserved, so nothing shifts when the handle appears.
const Handle = styled.button`
  flex: none;
  width: 18px;
  align-self: stretch;
  min-height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: ${admin.ghost};
  font-size: 12px;
  line-height: 1;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.12s;

  &:active {
    cursor: grabbing;
  }

  ${Row}:hover &,
  ${Row}:focus-within & {
    opacity: 1;
  }

  &:hover {
    color: ${admin.dim};
  }
`;

const Remove = styled.button`
  flex: none;
  width: 18px;
  min-height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: ${admin.ghost};
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;

  ${Row}:hover &,
  ${Row}:focus-within & {
    opacity: 1;
  }

  &:hover:not(:disabled) {
    color: #b91c1c;
  }

  &:disabled {
    cursor: default;
    opacity: 0;
  }
`;

const Fill = styled.div`
  flex: 1;
  min-width: 0;
  padding: 2px 0;
`;

const Line = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 7px;
`;

const Mark = styled.span`
  flex: none;
  color: ${admin.accent};
  font-size: 13px;
  line-height: 21px;
`;

const DropLine = styled.div`
  position: absolute;
  left: 18px;
  right: 0;
  top: -1px;
  height: 2px;
  border-radius: 2px;
  background: ${admin.accent};
`;

const DropLineEnd = styled(DropLine)`
  top: auto;
  bottom: -1px;
`;

const AddBar = styled.div`
  display: flex;
  gap: 6px;
  padding: 6px 0 0 18px;
`;

const AddButton = styled.button`
  padding: 4px 9px;
  border: 1px solid ${admin.line};
  border-radius: 7px;
  background: transparent;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 700;
  color: ${admin.dim2};
  cursor: pointer;

  &:hover {
    border-color: ${admin.accent};
    color: ${admin.accent};
  }
`;

const ImageBox = styled.div`
  margin: 2px 0;
  border: 1px solid ${admin.line3};
  border-radius: 11px;
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

const ImageBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid ${admin.hair};
`;

const Unknown = styled.p`
  margin: 2px 0;
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim};
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
