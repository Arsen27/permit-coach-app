import React from 'react';
import styled from 'styled-components';

import type { LessonCards } from '@admin/model/renderCard';
import { admin } from '@admin/styles/theme';

import CardView from './CardView';

// The lesson on its own: the card sequence exactly as the player builds it.

type Props = {
  lesson: LessonCards;
  meta: string;
};

const SingleTextView: React.FC<Props> = ({ lesson, meta }) => (
  <Column>
    <Head>
      <Title>{lesson.title}</Title>
      <Meta>{meta}</Meta>
    </Head>
    <Cards>
      {lesson.cards.map((card, index) => (
        <CardView key={card.key} card={card} index={index} />
      ))}
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
