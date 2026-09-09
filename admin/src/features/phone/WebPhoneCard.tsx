import React from 'react';
import styled from 'styled-components';

import { toneColor } from '@admin/features/viewer/CardView';
import type { RenderCard } from '@admin/model/renderCard';
import { assetSrc } from '@admin/model/svg';

// One lesson card drawn at phone size in web markup. The RN renderer cannot
// carry diff marks or contentEditable, so the two phone modes that need rich
// text — diffing and in-place editing — draw through this instead. Typography
// mirrors the app player (Plus Jakarta, 24px titles, 15px body).

export type WebPhoneSlots = {
  title?: React.ReactNode;
  ask?: React.ReactNode;
  bodies?: React.ReactNode[];
  options?: React.ReactNode[];
  imageAlt?: React.ReactNode;
};

type EditableProps = {
  onTitle?: (text: string) => void;
  onBody?: (index: number, text: string) => void;
  onAsk?: (text: string) => void;
};

type Props = {
  card: RenderCard;
  slots?: WebPhoneSlots;
  editable?: EditableProps | null;
  badge?: 'added' | 'removed' | null;
};

const commit =
  (handler: ((text: string) => void) | undefined) =>
  (event: React.FocusEvent<HTMLElement>) => {
    handler?.(event.currentTarget.textContent ?? '');
  };

const WebPhoneCard: React.FC<Props> = ({
  card,
  slots,
  editable = null,
  badge = null,
}) => {
  const color = toneColor(card.kicker.tone);
  const bodies = slots?.bodies ?? card.bodies;

  return (
    <Wrap>
      <Kicker $color={color}>
        {card.kicker.label}
        {badge === 'added' && <Badge $tone="add">ADDED</Badge>}
        {badge === 'removed' && <Badge $tone="del">REMOVED</Badge>}
      </Kicker>

      {(card.title.length > 0 || slots?.title != null) && (
        <Title
          contentEditable={editable?.onTitle != null}
          suppressContentEditableWarning
          onBlur={
            editable?.onTitle == null ? undefined : commit(editable.onTitle)
          }
        >
          {slots?.title ?? card.title}
        </Title>
      )}

      {card.image != null && (
        <Figure>
          {card.image.sha256 != null ? (
            <ArtImage src={assetSrc(card.image)} alt={card.image.alt ?? ''} />
          ) : null}
          <FigureLabel>{slots?.imageAlt ?? card.image.alt}</FigureLabel>
        </Figure>
      )}

      {bodies.map((body, index) => (
        <Body
          key={index}
          contentEditable={editable?.onBody != null}
          suppressContentEditableWarning
          onBlur={
            editable?.onBody == null
              ? undefined
              : event =>
                  editable.onBody?.(
                    index,
                    event.currentTarget.textContent ?? '',
                  )
          }
        >
          {body}
        </Body>
      ))}

      {(card.ask != null || slots?.ask != null) && (
        <Ask
          contentEditable={editable?.onAsk != null}
          suppressContentEditableWarning
          onBlur={editable?.onAsk == null ? undefined : commit(editable.onAsk)}
        >
          {slots?.ask ?? card.ask}
        </Ask>
      )}

      {card.options != null && card.options.length > 0 && (
        <Options>
          {card.options.map((option, index) => (
            <Option key={option.id} $correct={option.correct}>
              <OptionText $correct={option.correct}>
                {slots?.options?.[index] ?? option.text}
              </OptionText>
              {option.correct ? <Tick /> : <Radio />}
            </Option>
          ))}
        </Options>
      )}
    </Wrap>
  );
};

export default WebPhoneCard;

const Wrap = styled.div`
  padding: 26px 24px 0;
  font-family: 'PlusJakartaSans-Medium', 'Plus Jakarta Sans', system-ui,
    sans-serif;
`;

const Kicker = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
  margin-bottom: 12px;
`;

const Badge = styled.span<{ $tone: 'add' | 'del' }>`
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.6px;
  padding: 2px 7px;
  border-radius: 99px;
  color: ${({ $tone }) => ($tone === 'add' ? '#166534' : '#B91C1C')};
  background: ${({ $tone }) =>
    $tone === 'add' ? 'rgba(34,197,94,.14)' : 'rgba(239,68,68,.12)'};
`;

const editableRing = `
  &[contenteditable='true']:focus {
    outline: 1.5px dashed rgba(4, 133, 247, 0.55);
    outline-offset: 4px;
    border-radius: 4px;
  }
`;

const Title = styled.h1`
  margin: 0 0 14px;
  font-family: 'PlusJakartaSans-ExtraBold', 'Plus Jakarta Sans', system-ui,
    sans-serif;
  font-size: 24px;
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: -0.7px;
  color: #18181b;
  text-wrap: pretty;
  ${editableRing}
`;

const Body = styled.p`
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.6;
  font-weight: 500;
  color: #3f3f46;
  text-wrap: pretty;
  ${editableRing}
`;

const Ask = styled.p`
  margin: 4px 0 14px;
  font-family: 'PlusJakartaSans-ExtraBold', 'Plus Jakarta Sans', system-ui,
    sans-serif;
  font-size: 17px;
  line-height: 1.4;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: #18181b;
  ${editableRing}
`;

const Figure = styled.div`
  position: relative;
  margin: 4px 0 12px;
  border-radius: 16px;
  overflow: hidden;
  background: #f1f1f3;
`;

const Art = styled.div`
  display: flex;
  aspect-ratio: 16 / 9;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const FigureLabel = styled.span`
  position: absolute;
  left: 8px;
  bottom: 8px;
  font: 500 9.5px 'JetBrains Mono', ui-monospace, monospace;
  color: #71717a;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  padding: 3px 6px;
  max-width: 85%;
`;

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
`;

const Option = styled.div<{ $correct: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid ${({ $correct }) => ($correct ? '#16A34A' : '#E4E4E7')};
  border-radius: 14px;
  background: ${({ $correct }) =>
    $correct ? 'rgba(34,197,94,.07)' : '#FFFFFF'};
`;

const OptionText = styled.span<{ $correct: boolean }>`
  flex: 1;
  font-size: 14.5px;
  line-height: 1.45;
  font-weight: 600;
  color: #27272a;
`;

const Radio = styled.span`
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 99px;
  border: 1.5px solid #d4d4d8;
  box-sizing: border-box;
`;

const Tick = styled.span`
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 99px;
  background: #16a34a;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 6.5px;
    top: 4px;
    width: 4px;
    height: 8px;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(45deg);
  }
`;

const ArtImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
