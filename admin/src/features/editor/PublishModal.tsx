import React, { useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import { ApiError } from '@admin/api/client';
import type { Channel, ChannelMove, ChannelPointers } from '@admin/api/types';
import { GhostButton, PrimaryButton, Spacer } from '@admin/features/shell/ui';
import { admin } from '@admin/styles/theme';

// Publishing points a channel at a released version — staging for a look on a
// device in dev mode, production for everyone. Rolling back is the same move
// to an older version. Nothing is deployed: the next time an app opens, the
// channel simply answers differently. Production only takes a version that
// has been on staging; the server refuses anything else.

type Props = {
  courseId: string;
  version: string;
  channels: ChannelPointers;
  onClose: () => void;
  onPublished: (move: ChannelMove) => void;
};

const isBelow = (version: string, other: string): boolean => {
  const [a, b] = [version, other].map(v => v.split('.').map(Number));
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] < b[i];
    }
  }
  return false;
};

const PublishModal: React.FC<Props> = ({
  courseId,
  version,
  channels,
  onClose,
  onPublished,
}) => {
  const [channel, setChannel] = useState<Channel>('staging');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChannelMove | null>(null);

  const from = channels[channel];
  const same = from === version;
  const rollback = from != null && isBelow(version, from);
  const needsConfirm = channel === 'production';
  const ready = !busy && !same && (!needsConfirm || confirm.trim() === version);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const move = await adminApi.publishChannel(courseId, channel, version);
      setResult(move);
      onPublished(move);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : (caught as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop onClick={onClose}>
      <Dialog onClick={event => event.stopPropagation()}>
        <Title>Publish v{version}</Title>
        <Subtitle>
          Points a channel at this release. Apps on that channel pick it up the
          next time they open; nothing is deployed.
        </Subtitle>

        <Options>
          {(['staging', 'production'] as const).map(item => (
            <Option
              key={item}
              $active={item === channel}
              disabled={result != null}
              onClick={() => {
                setChannel(item);
                setConfirm('');
                setError(null);
              }}
            >
              <OptionName>
                {item === 'staging' ? 'Staging' : 'Production'}
              </OptionName>
              <OptionSub>
                {channels[item] == null
                  ? 'nothing published yet'
                  : `now v${channels[item]}`}
              </OptionSub>
            </Option>
          ))}
        </Options>

        {result == null ? (
          <>
            {same && (
              <Notice>
                {channel === 'staging' ? 'Staging' : 'Production'} already
                serves v{version}.
              </Notice>
            )}
            {rollback && (
              <Warn>
                Rollback: devices on v{from} will download v{version} whole the
                next time they open.
              </Warn>
            )}
            {needsConfirm && !same && (
              <ConfirmRow>
                <ConfirmLabel>
                  Type <Code>{version}</Code> to publish to everyone
                </ConfirmLabel>
                <Input
                  value={confirm}
                  placeholder={version}
                  onChange={event => setConfirm(event.target.value)}
                />
              </ConfirmRow>
            )}
            {error != null && <Output $ok={false}>{error}</Output>}
          </>
        ) : (
          <Output $ok>
            {result.channel === 'production' ? 'Production' : 'Staging'} now
            serves v{result.to}
            {result.from == null ? '' : ` (was v${result.from})`}.
          </Output>
        )}

        <Actions>
          <GhostButton onClick={onClose}>
            {result != null ? 'Done' : 'Cancel'}
          </GhostButton>
          <Spacer />
          {result == null && (
            <PrimaryButton disabled={!ready} onClick={() => void publish()}>
              {busy
                ? 'Publishing…'
                : rollback
                ? `Roll back ${channel}`
                : `Publish to ${channel}`}
            </PrimaryButton>
          )}
        </Actions>
      </Dialog>
    </Backdrop>
  );
};

export default PublishModal;

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
  width: 480px;
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

const Options = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
`;

const Option = styled.button<{ $active: boolean }>`
  text-align: left;
  font-family: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  background: ${({ $active }) => ($active ? admin.accentSoft : admin.soft)};
  border: 1px solid ${({ $active }) => ($active ? admin.accent : admin.line)};

  &:disabled {
    cursor: default;
  }
`;

const OptionName = styled.span`
  display: block;
  font-size: 12.5px;
  font-weight: 800;
  color: ${admin.ink};
`;

const OptionSub = styled.span`
  display: block;
  margin-top: 2px;
  font: 600 10.5px ${admin.mono};
  color: ${admin.dim};
`;

const Notice = styled.p`
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: ${admin.dim};
`;

const Warn = styled.p`
  margin: 0 0 10px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
  color: #92400e;
  background: rgba(217, 119, 6, 0.12);
`;

const ConfirmRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
`;

const ConfirmLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${admin.muted};
`;

const Input = styled.input`
  font: 600 12.5px ${admin.mono};
  color: ${admin.ink};
  border: 1px solid ${admin.line};
  border-radius: 9px;
  padding: 8px 11px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const Code = styled.code`
  font: 600 11.5px ${admin.mono};
  background: ${admin.bg};
  padding: 1px 5px;
  border-radius: 5px;
`;

const Output = styled.div<{ $ok: boolean }>`
  padding: 10px 13px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 600;
  color: ${({ $ok }) => ($ok ? '#166534' : '#B91C1C')};
  background: ${({ $ok }) =>
    $ok ? 'rgba(22,163,74,.08)' : 'rgba(239,68,68,.08)'};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 18px;
`;
