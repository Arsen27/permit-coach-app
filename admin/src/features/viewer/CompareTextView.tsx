import React from 'react';
import styled from 'styled-components';

import type { CompareRow } from '@admin/model/compare';
import type { RenderCard } from '@admin/model/renderCard';
import { admin } from '@admin/styles/theme';

import CardView, { type CardSlots } from './CardView';
import DiffRuns from './DiffRuns';

// Side-by-side lesson comparison. The selected version stays on the left, the
// reference on the right, and each cell only ever shows its own side of the
// diff.

type Props = {
  rows: CompareRow[];
  leftLabel: string;
  rightLabel: string;
  leftAbsentNote?: string | null;
};

const slotsFor = (
  row: CompareRow,
  side: 'before' | 'after',
  card: RenderCard,
): CardSlots | undefined => {
  if (row.diff == null) {
    return undefined;
  }
  const { diff } = row;
  return {
    title: <DiffRuns runs={diff.title} side={side} />,
    ask:
      diff.ask == null ? undefined : <DiffRuns runs={diff.ask} side={side} />,
    bodies: card.bodies.map((_, index) => (
      <DiffRuns key={index} runs={diff.bodies[index] ?? []} side={side} />
    )),
    options: (card.options ?? []).map((_, index) => (
      <DiffRuns key={index} runs={diff.options[index] ?? []} side={side} />
    )),
    imageAlt:
      diff.imageAlt == null ? undefined : (
        <DiffRuns runs={diff.imageAlt} side={side} />
      ),
  };
};

const CompareTextView: React.FC<Props> = ({
  rows,
  leftLabel,
  rightLabel,
  leftAbsentNote,
}) => (
  <Wrap>
    {leftAbsentNote != null && <Banner>{leftAbsentNote}</Banner>}
    <Grid>
      {rows.map((row, index) => (
        <React.Fragment key={row.key}>
          <Cell>
            {row.left == null ? (
              <Missing>Not in {leftLabel}</Missing>
            ) : (
              <CardView
                compact
                card={row.left}
                index={index}
                slots={slotsFor(row, 'after', row.left)}
                artworkChanged={row.artworkChanged}
                badge={row.added ? 'added' : undefined}
                borderColor={row.added ? admin.diff.addedBorder : undefined}
              />
            )}
          </Cell>
          <Cell>
            {row.right == null ? (
              <Missing>Not in {rightLabel}</Missing>
            ) : (
              <CardView
                compact
                card={row.right}
                index={index}
                slots={slotsFor(row, 'before', row.right)}
                artworkChanged={row.artworkChanged}
                badge={row.removed ? 'removed' : undefined}
                borderColor={row.removed ? admin.diff.removedBorder : undefined}
              />
            )}
          </Cell>
        </React.Fragment>
      ))}
    </Grid>
  </Wrap>
);

export default CompareTextView;

const Wrap = styled.div`
  max-width: 1240px;
  margin: 0 auto;
`;

const Banner = styled.div`
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(22, 163, 74, 0.08);
  border: 1px solid rgba(22, 163, 74, 0.25);
  font-size: 12px;
  font-weight: 600;
  color: #166534;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 13px 20px;
`;

const Cell = styled.div`
  min-width: 0;
`;

const Missing = styled.div`
  border: 1.5px dashed #d9d9dc;
  border-radius: 14px;
  min-height: 72px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.faint};
`;
