import React from 'react';
import styled from 'styled-components';

import { SectionLabel } from '@admin/features/shell/ui';
import { toneColor } from '@admin/features/viewer/CardView';
import { admin } from '@admin/styles/theme';

import {
  CARD_FORMATS,
  COMPETITOR_FORMATS,
  AUTHORING_NOTES,
  LESSON_CONSTRAINTS,
  type FormatSpec,
} from './formatSpecs';

// Reference for whoever authors or reviews content: what each card type is
// for, what it must carry, and the key the content API stores it under.

const Card: React.FC<{ spec: FormatSpec }> = ({ spec }) => (
  <Spec>
    <SpecHead>
      <Swatch $color={toneColor(spec.tone)} />
      <Name>{spec.label}</Name>
      <Api>{spec.api}</Api>
    </SpecHead>
    <Who>{spec.who}</Who>
    <Rows>
      <Row>
        <RowLabel>Fields</RowLabel>
        <Fields>{spec.fields}</Fields>
      </Row>
      <Row>
        <RowLabel>Rules</RowLabel>
        <Rules>{spec.rules}</Rules>
      </Row>
    </Rows>
  </Spec>
);

const FormatsScreen: React.FC = () => (
  <Screen>
    <Column>
      <Title>Card formats</Title>
      <Intro>
        Every lesson is a sequence of typed cards. Each type has a fixed
        pedagogical role, a fixed field set, and rendering rules the mobile app
        relies on — this panel and the app draw them from the same table, so
        what is described here is what a learner sees.
      </Intro>

      <SectionLabel>Card-sequence lessons — our course</SectionLabel>
      <Grid>
        {CARD_FORMATS.map(spec => (
          <Card key={spec.type} spec={spec} />
        ))}
      </Grid>

      <SectionLabel>
        Article and slide lessons — competitor captures
      </SectionLabel>
      <Grid>
        {COMPETITOR_FORMATS.map(spec => (
          <Card key={spec.type} spec={spec} />
        ))}
      </Grid>

      <Constraints>
        <SectionLabel>Lesson-level constraints</SectionLabel>
        <ConstraintText>{LESSON_CONSTRAINTS}</ConstraintText>
      </Constraints>

      <Constraints>
        <SectionLabel>What an author controls</SectionLabel>
        <ConstraintText>{AUTHORING_NOTES}</ConstraintText>
      </Constraints>
    </Column>
  </Screen>
);

export default FormatsScreen;

const Screen = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 28px 30px 70px;
`;

const Column = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Title = styled.h2`
  margin: 0 0 4px;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const Intro = styled.p`
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.dim};
  max-width: 640px;
  text-wrap: pretty;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  gap: 13px;
  margin: 0 0 16px;
`;

const Spec = styled.div`
  background: ${admin.surface};
  border: 1px solid ${admin.line3};
  border-radius: 14px;
  padding: 16px 19px;
  display: flex;
  flex-direction: column;
  gap: 9px;
`;

const SpecHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Swatch = styled.div<{ $color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: ${({ $color }) => $color};
`;

const Name = styled.span`
  flex: 1;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: ${admin.ink};
`;

const Api = styled.span`
  font: 600 10px ${admin.mono};
  color: ${admin.dim};
  background: ${admin.bg};
  padding: 2.5px 7px;
  border-radius: 6px;
`;

const Who = styled.p`
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.body};
  text-wrap: pretty;
`;

const Rows = styled.div`
  border-top: 1px solid ${admin.hair};
  padding-top: 9px;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
`;

const RowLabel = styled.span`
  flex: none;
  width: 52px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${admin.dim2};
  padding-top: 2px;
`;

const Fields = styled.span`
  font: 500 11px ${admin.mono};
  line-height: 1.55;
  color: ${admin.muted};
`;

const Rules = styled.span`
  font-size: 11.5px;
  line-height: 1.55;
  font-weight: 500;
  color: ${admin.muted};
`;

const Constraints = styled.div`
  background: ${admin.surface};
  border: 1px solid ${admin.line3};
  border-radius: 14px;
  padding: 16px 19px;
  max-width: 660px;
`;

const ConstraintText = styled.p`
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  font-weight: 500;
  color: ${admin.body};
  text-wrap: pretty;
`;
