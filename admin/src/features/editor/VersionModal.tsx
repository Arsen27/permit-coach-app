import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { PrimaryButton } from '@admin/features/shell/ui';
import { admin } from '@admin/styles/theme';

// Naming a new version. The number is the operator's to choose — the panel
// only offers the next free one and explains what the change implies.

type Props = {
  title: string;
  subtitle: string;
  note: string;
  hint?: string | null;
  confirmLabel: string;
  initialValue: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (version: string) => void;
  onClose: () => void;
};

const VersionModal: React.FC<Props> = ({
  title,
  subtitle,
  note,
  hint,
  confirmLabel,
  initialValue,
  busy = false,
  error,
  onConfirm,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => setValue(initialValue), [initialValue]);

  return (
    <Backdrop onClick={onClose}>
      <Dialog onClick={event => event.stopPropagation()}>
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>

        <Label>New version number</Label>
        <Input
          autoFocus
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && value.trim().length > 0) {
              onConfirm(value.trim());
            }
          }}
        />
        {hint != null && <Hint>{hint}</Hint>}
        <Note>{note}</Note>
        {error != null && <Error>{error}</Error>}

        <Actions>
          <Cancel onClick={onClose}>Cancel</Cancel>
          <PrimaryButton
            disabled={busy || value.trim().length === 0}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </PrimaryButton>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};

export default VersionModal;

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
  width: 420px;
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
  margin: 0 0 16px;
  font-size: 12.5px;
  line-height: 1.55;
  font-weight: 500;
  color: ${admin.dim};
  text-wrap: pretty;
`;

const Label = styled.span`
  display: block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${admin.dim2};
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  font: 700 15px ${admin.mono};
  color: ${admin.ink};
  border: 1.5px solid ${admin.line};
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const Hint = styled.p`
  margin: 9px 0 0;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.accent};
`;

const Note = styled.p`
  margin: 9px 0 0;
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim};
`;

const Error = styled.p`
  margin: 10px 0 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #b91c1c;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 20px;
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
