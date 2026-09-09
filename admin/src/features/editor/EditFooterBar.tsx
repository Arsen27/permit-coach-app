import React from 'react';
import styled from 'styled-components';

import { GhostButton, PrimaryButton, Spacer } from '@admin/features/shell/ui';
import { changedFieldCount, useEdit } from '@admin/store/editStore';
import { admin } from '@admin/styles/theme';

// Sits under the editor: what changed, and the three ways out of it.

type Props = {
  versionLabel: string;
  onDiscard: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
};

const EditFooterBar: React.FC<Props> = ({
  versionLabel,
  onDiscard,
  onSave,
  onSaveAsNew,
}) => {
  const changed = useEdit(changedFieldCount);
  const saving = useEdit(state => state.saving);

  return (
    <Bar>
      <Info>
        Editing {versionLabel} · {changed} field{changed === 1 ? '' : 's'}{' '}
        changed
      </Info>
      <Spacer />
      <Discard onClick={onDiscard}>Discard</Discard>
      <SaveHere disabled={saving} onClick={onSave}>
        Save to {versionLabel}
      </SaveHere>
      <PrimaryButton disabled={saving} onClick={onSaveAsNew}>
        Save as new version…
      </PrimaryButton>
    </Bar>
  );
};

export default EditFooterBar;

const Bar = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 18px;
  background: ${admin.surface};
  border-top: 1px solid ${admin.line};
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.04);
`;

const Info = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${admin.dim};
`;

const Discard = styled.button`
  padding: 7px 13px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  color: ${admin.dim};
  cursor: pointer;

  &:hover {
    background: ${admin.bg};
  }
`;

const SaveHere = styled(GhostButton)`
  border-width: 1.5px;
  border-color: ${admin.accent};
  color: ${admin.accent};
  font-weight: 800;
`;
