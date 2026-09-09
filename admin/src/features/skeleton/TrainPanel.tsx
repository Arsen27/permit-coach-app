import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import { ApiError } from '@admin/api/client';
import type { GenerateResult, TrainStatus } from '@admin/api/types';
import { SmallButton, SmallInput } from '@admin/features/editor/fields';
import { Mono } from '@admin/features/shell/ui';
import { admin } from '@admin/styles/theme';

// The train.
//
// Generating is one action for every member at once, and it either cuts one
// version for all of them or cuts nothing and says why. That is the only thing
// that makes a single global number mean anything: a per-state number would let
// two states drift and still both call themselves current.
//
// Publishing from here reaches staging and stops. Production is a button
// somebody presses after looking at it on a device, and it stays that way even
// with nobody in the field yet — the habit is the point.

type Props = {
  onGenerated?: () => void;
};

const TrainPanel: React.FC<Props> = ({ onGenerated }) => {
  const [status, setStatus] = useState<TrainStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [refusal, setRefusal] = useState<string[] | null>(null);

  const reload = async () => setStatus(await adminApi.train());

  useEffect(() => {
    void reload();
  }, []);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setRefusal(null);
    setResult(null);
    try {
      const generated = await adminApi.generateTrain({
        bump: 'patch',
        notes,
        dryRun,
      });
      setResult(generated);
      await reload();
      onGenerated?.();
    } catch (error) {
      const failure = error as ApiError;
      setRefusal(
        failure.errors != null && failure.errors.length > 0
          ? [failure.message, ...failure.errors]
          : [failure.message],
      );
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (result == null) {
      return;
    }
    setBusy(true);
    try {
      await adminApi.publishTrainStaging(result.version, 'train');
      await reload();
    } catch (error) {
      setRefusal([(error as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel data-train-panel>
      <Title>Train</Title>
      {status == null ? (
        <Note>loading…</Note>
      ) : (
        <>
          <Note>
            {status.train.join(' + ')} move together · next version{' '}
            <Mono $size={10.5} $weight={700}>
              {status.nextVersion}
            </Mono>
          </Note>
          <Rows>
            {status.members.map(member => (
              <Row
                key={member.courseId}
                data-train-member={member.courseId}
                data-train-membership={member.member ? 'member' : 'outside'}
              >
                <RowHead>
                  <Mono $size={10.5} $weight={700}>
                    {member.stateCode || '—'}
                  </Mono>
                  <Course>{member.courseId}</Course>
                  {member.member ? (
                    <Chip $tone="member">in the train</Chip>
                  ) : (
                    <Chip $tone="outside">not a member</Chip>
                  )}
                </RowHead>
                <Detail>
                  latest {member.latest ?? '—'} · staging{' '}
                  {member.staging ?? '—'} · production{' '}
                  {member.production ?? '—'}
                  {member.member && ` · ${member.pending} edit(s) pending`}
                </Detail>
                {member.reason != null && <Why>{member.reason}</Why>}
              </Row>
            ))}
          </Rows>

          <SmallInput
            value={notes}
            placeholder="What this version holds"
            aria-label="Release notes"
            onChange={event => setNotes(event.target.value)}
          />
          <Actions>
            <SmallButton
              disabled={busy}
              data-train-dry-run
              onClick={() => void run(true)}
            >
              Preview
            </SmallButton>
            <SmallButton
              disabled={busy}
              data-train-generate
              onClick={() => void run(false)}
            >
              {busy ? 'Generating…' : 'Generate'}
            </SmallButton>
          </Actions>

          {refusal != null && (
            <Refused data-train-refusal>
              {refusal.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </Refused>
          )}

          {result != null && (
            <Result data-train-result={result.version}>
              <ResultHead>
                cut {result.version} for {result.states.length} states
              </ResultHead>
              {result.states.map(state => (
                <ResultRow key={state.courseId}>
                  <Mono $size={10} $weight={700}>
                    {state.stateCode}
                  </Mono>{' '}
                  {state.changed ? 'changed' : 'unchanged'} ·{' '}
                  {state.instructions.length === 0
                    ? 'no instructions'
                    : state.instructions
                        .map(instruction => instruction.op)
                        .join(', ')}
                </ResultRow>
              ))}
              <SmallButton
                disabled={busy}
                data-train-publish
                onClick={() => void publish()}
              >
                Publish to staging
              </SmallButton>
              <Note>
                Production is a button somebody presses after looking at this on
                a device.
              </Note>
            </Result>
          )}
        </>
      )}
    </Panel>
  );
};

export default TrainPanel;

const Panel = styled.aside`
  flex: none;
  width: 320px;
  border-left: 1px solid ${admin.line};
  background: ${admin.surface};
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  gap: 8px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: ${admin.muted};
`;

const Note = styled.p`
  margin: 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: ${admin.faint};
`;

const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Row = styled.div`
  padding: 7px 6px;
  border-bottom: 1px solid ${admin.hair};
`;

const RowHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 7px;
`;

const Course = styled.span`
  flex: 1;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.body};
`;

const Chip = styled.span<{ $tone: 'member' | 'outside' }>`
  font: 700 8.5px ${admin.mono};
  letter-spacing: 0.3px;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 99px;
  color: ${({ $tone }) => ($tone === 'member' ? '#0369A1' : '#6D28D9')};
  background: ${({ $tone }) =>
    $tone === 'member' ? admin.accentSoft : 'rgba(124,58,237,.12)'};
`;

const Detail = styled.p`
  margin: 3px 0 0;
  font: 500 9.5px ${admin.mono};
  color: ${admin.faint};
`;

const Why = styled.p`
  margin: 2px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: ${admin.faint};
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
`;

const Refused = styled.ul`
  margin: 0;
  padding-left: 16px;
  font-size: 10.5px;
  line-height: 1.55;
  color: #b91c1c;
`;

const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid ${admin.line3};
  border-radius: 10px;
  background: ${admin.soft};
`;

const ResultHead = styled.p`
  margin: 0;
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.ink};
`;

const ResultRow = styled.p`
  margin: 0;
  font-size: 10.5px;
  color: ${admin.body};
`;
