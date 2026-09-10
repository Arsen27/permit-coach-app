import React from 'react';
import styled from 'styled-components';

import type { StateOrigins } from '@admin/api/types';
import OriginBadge from '@admin/features/skeleton/OriginBadge';
import { originOf } from '@admin/model/blockOrigin';
import type { LessonCards } from '@admin/model/renderCard';
import { admin } from '@admin/styles/theme';

import CardView from './CardView';

// The lesson on its own: the card sequence exactly as the player builds it.
//
// On a course generated from the skeleton each card also says where it comes
// from, because on this screen they otherwise look alike — and editing a shared
// one here was the dead end this step closes.

type Props = {
  lesson: LessonCards;
  meta: string;
  origins?: StateOrigins | null;
  busy?: boolean;
  onRevert?: (bareId: string) => void;
  onPromote?: (bareId: string) => void;
};

const SingleTextView: React.FC<Props> = ({
  lesson,
  meta,
  origins = null,
  busy = false,
  onRevert,
  onPromote,
}) => (
  <Column>
    <Head>
      <Title>{lesson.title}</Title>
      <Meta>{meta}</Meta>
    </Head>
    <Cards>
      {lesson.cards.map((card, index) => {
        const where = originOf(origins, card.refs.blockId);
        return (
          <div key={card.key}>
            {/* Only material with a shared counterpart is marked: on a course
                nothing regenerates, every card is the course's own and a badge
                on each would be noise. */}
            {where != null && origins != null && where.origin !== 'own' && (
              <OriginBadge
                origin={where.origin}
                stateCode={origins.stateCode}
                bareId={where.bareId}
                busy={busy}
                onRevert={() => onRevert?.(where.bareId)}
                onPromote={() => onPromote?.(where.bareId)}
              />
            )}
            <CardView
              card={card}
              index={index}
              lessonId={lesson.lessonId}
              cardCount={lesson.cards.length}
            />
          </div>
        );
      })}
    </Cards>
  </Column>
);

export default SingleTextView;

const Column = styled.div`
  max-width: 680px;
  margin: 0 auto;
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
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

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 13px;
`;
