import React from 'react';
import styled from 'styled-components';

import AuthedImage from '@admin/features/shell/AuthedImage';
import type { CardMeta } from '@/components/lesson/types';
import type { RenderCard } from '@admin/model/renderCard';
import { admin } from '@admin/styles/theme';
import { assetSrc } from '@admin/model/svg';

// One lesson card as the text view draws it. Diffed views pass rich nodes in
// place of the plain strings, which is why every text slot accepts a node.

export type CardSlots = {
  title?: React.ReactNode;
  ask?: React.ReactNode;
  bodies?: React.ReactNode[];
  options?: React.ReactNode[];
  imageAlt?: React.ReactNode;
};

const TONE_COLOR: Record<string, string> = {
  accent: '#00A36A',
  muted: admin.dim,
  trap: '#D97706',
  california: '#00693C',
};

export const toneColor = (tone: string): string =>
  TONE_COLOR[tone] ?? admin.dim;

// An authored slide type may set its own kicker colour; the tone is only the
// fallback palette slot.
export const kickerColor = (kicker: CardMeta): string =>
  kicker.textColor ?? toneColor(kicker.tone);

type Props = {
  card: RenderCard;
  index: number;
  // What the card belongs to, so an excerpt taken out of it can say where it
  // came from. The viewer that knows the lesson passes them; a preview that
  // does not simply leaves them off.
  lessonId?: string;
  cardCount?: number;
  slots?: CardSlots;
  badge?: 'added' | 'removed';
  borderColor?: string;
  compact?: boolean;
  artworkChanged?: boolean;
};

const CardView: React.FC<Props> = ({
  card,
  index,
  lessonId,
  cardCount,
  slots,
  badge,
  borderColor,
  compact = false,
  artworkChanged = false,
}) => {
  const color = kickerColor(card.kicker);
  const bodies = slots?.bodies ?? card.bodies;
  const options = slots?.options;
  // Line 1 is the title, then each body line, then the question and its
  // answers. `line` walks that order as the card is drawn, so the numbers a
  // reader could count off the screen are the numbers an excerpt reports.
  let line = 0;
  const nextLine = () => (line += 1);

  return (
    <Card
      $border={borderColor}
      $compact={compact}
      data-block-id={card.refs.blockId ?? card.key}
      data-card-index={index + 1}
      {...(cardCount != null && { 'data-card-count': cardCount })}
      {...(lessonId != null && { 'data-lesson-id': lessonId })}
      data-kicker={card.kicker.label}
    >
      <Head>
        <Index>{String(index + 1).padStart(2, '0')}</Index>
        <Kicker $color={color}>{card.kicker.label}</Kicker>
        {card.optional === true && <Optional>optional</Optional>}
        <Spacer />
        {artworkChanged && <ArtBadge>ARTWORK</ArtBadge>}
        {badge === 'added' && <Added>ADDED</Added>}
        {badge === 'removed' && <Removed>REMOVED</Removed>}
      </Head>

      {(slots?.title ?? card.title).toString().length > 0 && (
        <Title $compact={compact} data-line={nextLine()}>
          {slots?.title ?? card.title}
        </Title>
      )}

      {bodies.map((body, bodyIndex) => (
        <Body key={bodyIndex} data-line={nextLine()}>
          {body}
        </Body>
      ))}

      {card.image != null && (
        <Figure $changed={artworkChanged}>
          {card.image.sha256 != null ? (
            <ArtImage src={assetSrc(card.image)} alt={card.image.alt ?? ''} />
          ) : card.image.url != null ? (
            <Photo
              src={`/v1/admin/competitors/assets/${card.image.url}`}
              alt={card.image.alt}
              loading="lazy"
            />
          ) : (
            <Hatch />
          )}
          <FigureLabel>{slots?.imageAlt ?? card.image.alt}</FigureLabel>
        </Figure>
      )}

      {/* Artwork placed inside the body. The diff has no per-element slots,
          so these are drawn plainly under the prose they belong to. */}
      {(card.inlineImages ?? []).map(inline => (
        <Figure key={inline.assetId} $changed={false}>
          {inline.sha256 != null ? (
            <ArtImage src={assetSrc(inline)} alt={inline.alt ?? ''} />
          ) : (
            <Hatch />
          )}
          <FigureLabel>{inline.alt}</FigureLabel>
        </Figure>
      ))}

      {(slots?.ask ?? card.ask) != null && (
        <Ask data-line={nextLine()}>{slots?.ask ?? card.ask}</Ask>
      )}

      {card.options != null && card.options.length > 0 && (
        <Options>
          {card.options.map((option, optionIndex) => (
            <Option key={option.id} $correct={option.correct}>
              {option.correct ? <Tick /> : <Radio />}
              <OptionText $correct={option.correct} data-line={nextLine()}>
                {options?.[optionIndex] ?? option.text}
              </OptionText>
            </Option>
          ))}
        </Options>
      )}
    </Card>
  );
};

export default CardView;

const Card = styled.article<{ $border?: string; $compact: boolean }>`
  background: ${admin.surface};
  border: 1px solid ${({ $border }) => $border ?? admin.line3};
  border-radius: 14px;
  padding: ${({ $compact }) => ($compact ? '15px 17px' : '17px 20px')};
  height: 100%;
  box-sizing: border-box;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
`;

const Index = styled.span`
  font: 600 10px ${admin.mono};
  color: ${admin.ghost};
`;

const Kicker = styled.span<{ $color: string }>`
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
`;

const Optional = styled.span`
  font-size: 9px;
  font-weight: 700;
  color: ${admin.dim2};
`;

const Spacer = styled.div`
  flex: 1;
`;

const Added = styled.span`
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: #166534;
  background: rgba(34, 197, 94, 0.14);
  padding: 2px 6px;
  border-radius: 99px;
`;

const Removed = styled(Added)`
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.12);
`;

const ArtBadge = styled(Added)`
  color: #b45309;
  background: rgba(217, 119, 6, 0.13);
`;

const Title = styled.h3<{ $compact: boolean }>`
  margin: 0 0 7px;
  font-size: ${({ $compact }) => ($compact ? '15px' : '16px')};
  line-height: 1.35;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: ${admin.ink};
  text-wrap: pretty;
`;

const Body = styled.p`
  margin: 0 0 7px;
  font-size: 12.5px;
  line-height: 1.65;
  font-weight: 500;
  color: ${admin.body};
  text-wrap: pretty;
`;

const Ask = styled.p`
  margin: 10px 0 6px;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: ${admin.ink};
`;

const Figure = styled.div<{ $changed: boolean }>`
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  margin: 4px 0 8px;
  background: ${admin.hair};
  outline: ${({ $changed }) =>
    $changed ? '2px solid rgba(217,119,6,.45)' : 'none'};
  outline-offset: -2px;
`;

const Art = styled.div`
  display: flex;
  aspect-ratio: 16 / 9;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const Photo = styled(AuthedImage)`
  width: 100%;
  display: block;
  object-fit: cover;
  max-height: 260px;
`;

const Hatch = styled.div`
  aspect-ratio: 16 / 9;
  background: repeating-linear-gradient(
    135deg,
    #ececee 0 8px,
    #f5f5f6 8px 16px
  );
`;

const FigureLabel = styled.span`
  position: absolute;
  left: 7px;
  bottom: 7px;
  font: 500 9px ${admin.mono};
  color: ${admin.dim};
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  padding: 3px 6px;
`;

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 5px;
`;

const Option = styled.div<{ $correct: boolean }>`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border: 1px solid
    ${({ $correct }) => ($correct ? 'rgba(22,163,74,.4)' : admin.line3)};
  border-radius: 10px;
  background: ${({ $correct }) =>
    $correct ? 'rgba(34,197,94,.06)' : admin.surface};
`;

const Radio = styled.div`
  flex: none;
  width: 13px;
  height: 13px;
  border-radius: 99px;
  border: 1.5px solid #d4d4d8;
  box-sizing: border-box;
`;

const Tick = styled.div`
  flex: none;
  width: 13px;
  height: 13px;
  border-radius: 99px;
  background: #16a34a;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 2.5px;
    width: 3px;
    height: 6px;
    border-right: 1.6px solid #fff;
    border-bottom: 1.6px solid #fff;
    transform: rotate(45deg);
  }
`;

const OptionText = styled.span<{ $correct: boolean }>`
  flex: 1;
  font-size: 12px;
  line-height: 1.45;
  font-weight: 600;
  color: ${({ $correct }) => ($correct ? '#166534' : admin.body)};
`;

const ArtImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
