import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import type {
  DraftDiff,
} from '@admin/api/types';
import { GhostButton, PrimaryButton, Spacer } from '@admin/features/shell/ui';
import { admin } from '@admin/styles/theme';

// Releasing turns a draft into an immutable version. The panel works out what
// changed and what that implies for the version number; the number and the
// Delivery choice — how devices in the field take it — are the operator's
// call. (The old soft/optional/hard instruction plan fed a client that no
// longer exists: a fix never touches progress now, and what the learner is
// told comes from the Delivery taxonomy.)

type Props = {
  courseId: string;
  draftId: string;
  draftLabel: string;
  requireNote: boolean;
  onClose: () => void;
  onReleased: (version: string) => void;
};

// Whether the requested number is a patch on the base — the same rule the
// server derives the kind from.
const isPatchOf = (next: string, base: string): boolean => {
  const [nMaj, nMin] = next.trim().split('.');
  const [bMaj, bMin] = base.split('.');
  return nMaj === bMaj && nMin === bMin;
};

const DELIVERY_LABEL = {
  silent: 'silent fix',
  apology: 'fix + apology',
  rules: 'fix + rules changed',
  new_users: 'new users only',
  offer: 'offer to everyone',
} as const;

const DELIVERY_HELP = {
  silent: 'Replaced quietly; nobody is told anything.',
  apology:
    'Replaced, with an apology modal; the changed lessons a learner completed turn yellow until retaken.',
  rules:
    'Replaced, with a rules-changed modal; the changed lessons a learner completed turn yellow until retaken.',
  new_users: 'Existing users never see it; new installs start on it.',
  offer:
    'Existing users get a modal offering it, with an explicit progress-loss warning.',
} as const;

// The first app build whose updater understands opt-in offers. Older builds
// would auto-download an opt-in release, wiping nothing and asking nobody —
// minAppVersion is what keeps them out. An opt-in release may sit above this
// floor, never below it.
const OPT_IN_MIN_APP = '1.2.0';

const isBelow = (version: string, floor: string): boolean => {
  const a = version.split('.').map(Number);
  const b = floor.split('.').map(Number);
  if (a.length !== 3 || b.length !== 3 || [...a, ...b].some(Number.isNaN)) {
    return false;
  }
  return a[0] !== b[0]
    ? a[0] < b[0]
    : a[1] !== b[1]
    ? a[1] < b[1]
    : a[2] < b[2];
};

const ReleaseModal: React.FC<Props> = ({
  courseId,
  draftId,
  draftLabel,
  requireNote,
  onClose,
  onReleased,
}) => {
  const [diff, setDiff] = useState<DraftDiff | null>(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // Opt-in: a fundamentally new course. Clients are offered it instead of
  // auto-updating; accepting clears the learner's course progress. Forces a
  // single full instruction and a major version.
  const [optIn, setOptIn] = useState(false);
  // Every version carries its own minimum app build, not just the opt-in ones:
  // raising it here pins older installs at the previous version instead of
  // handing them content their build cannot read. It starts at whatever the
  // version below already demands, so leaving it alone changes nothing.
  const [minAppVersion, setMinAppVersion] = useState('');
  // What this release means for devices already in the field. The kind
  // follows the version number — a patch is a fix, anything wider a course
  // update — and the subtype is the author's call.
  const [updateSubtype, setUpdateSubtype] = useState<
    'silent' | 'apology' | 'rules' | 'new_users' | 'offer' | null
  >(null);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    let live = true;
    void adminApi
      .draftDiff(courseId, draftId)
      .then(result => {
        if (!live) {
          return;
        }
        setDiff(result);
        setVersion(result.suggestedVersion);
        setMinAppVersion(result.baseMinAppVersion);
      })
      .catch(error => setErrors([(error as Error).message]));
    return () => {
      live = false;
    };
  }, [courseId, draftId]);

  const toggleOptIn = (next: boolean) => {
    setOptIn(next);
    if (diff == null) {
      return;
    }
    if (next) {
      // A whole new course: next major version, and a floor no lower than
      // the first build that understands an offer.
      setVersion(`${Number(diff.baseVersion.split('.')[0]) + 1}.0.0`);
      setMinAppVersion(current =>
        isBelow(current, OPT_IN_MIN_APP) ? OPT_IN_MIN_APP : current,
      );
    } else {
      setVersion(diff.suggestedVersion);
      setMinAppVersion(diff.baseMinAppVersion);
    }
  };

  const kind: 'fix' | 'course' =
    diff == null || isPatchOf(version, diff.baseVersion) ? 'fix' : 'course';
  const subtypeOptions =
    kind === 'fix'
      ? (['silent', 'apology', 'rules'] as const)
      : (['new_users', 'offer'] as const);
  const effectiveSubtype =
    updateSubtype != null &&
    (subtypeOptions as readonly string[]).includes(updateSubtype)
      ? updateSubtype
      : subtypeOptions[0];

  const release = async () => {
    setBusy(true);
    setErrors([]);
    try {
      const result = await adminApi.release(courseId, draftId, {
        version: version.trim(),
        notes: notes.trim(),
        minAppVersion: minAppVersion.trim(),
        ...(optIn && { adoption: 'opt_in' as const }),
        updateKind: kind,
        updateSubtype: effectiveSubtype,
        ...(updateMessage.trim().length > 0 && {
          updateMessage: updateMessage.trim(),
        }),
      });
      onReleased(result.version);
    } catch (error) {
      const detail = error as { message: string; errors?: string[] };
      setErrors(detail.errors ?? [detail.message]);
    } finally {
      setBusy(false);
    }
  };

  const nothingToRelease = diff?.suggestedBump === 'none';
  const noteMissing = requireNote && notes.trim().length === 0;

  return (
    <Backdrop onClick={onClose}>
      <Dialog onClick={event => event.stopPropagation()}>
        <Title>Release {draftLabel}</Title>
        <Subtitle>
          Writes an immutable version and tells every client what to refetch.
          The draft is retired once it is released.
        </Subtitle>

        {diff == null ? (
          <Muted>working out what changed…</Muted>
        ) : nothingToRelease ? (
          <Muted>
            This draft is identical to {diff.baseVersion} — there is nothing to
            release.
          </Muted>
        ) : (
          <>
            <Summary>
              <SummaryRow>
                <Label>Changed</Label>
                <Value>
                  {diff.lessons.length} lesson
                  {diff.lessons.length === 1 ? '' : 's'}
                  {diff.modules.length > 0 &&
                    ` · ${diff.modules.length} module${
                      diff.modules.length === 1 ? '' : 's'
                    }`}
                  {diff.courseStructureChanged && ' · course structure'}
                </Value>
              </SummaryRow>
              <SummaryRow>
                <Label>Needs</Label>
                <Value>
                  a <strong>{diff.suggestedBump}</strong> bump from{' '}
                  {diff.baseVersion}
                </Value>
              </SummaryRow>
            </Summary>

            <FieldLabel>Version number</FieldLabel>
            <VersionInput
              value={version}
              onChange={event => setVersion(event.target.value)}
            />
            <Hint>Suggested {diff.suggestedVersion}</Hint>

            <FieldLabel>
              Change note{requireNote ? '' : ' (optional)'}
            </FieldLabel>
            <Notes
              rows={2}
              value={notes}
              placeholder="What changed and why"
              onChange={event => setNotes(event.target.value)}
            />

            <ToggleRow>
              <input
                type="checkbox"
                checked={optIn}
                onChange={event => toggleOptIn(event.target.checked)}
              />
              <ToggleText>
                <strong>Fundamentally new course (opt-in)</strong>
                <ToggleHint>
                  Learners are offered the new course instead of receiving it
                  automatically; the change note above is the pitch they read.
                  Accepting downloads it and clears their course progress.
                </ToggleHint>
              </ToggleText>
            </ToggleRow>

            <FieldLabel>Minimum app version</FieldLabel>
            <VersionInput
              value={minAppVersion}
              onChange={event => setMinAppVersion(event.target.value)}
            />
            <Hint>
              {optIn ? (
                <>
                  Builds older than this do not understand opt-in offers and
                  must not see the release. {OPT_IN_MIN_APP} is the first build
                  that does.
                </>
              ) : (
                <>
                  Older builds stop at {diff.baseVersion} and are told to
                  update, rather than taking content they cannot read. Inherited{' '}
                  {diff.baseMinAppVersion} — leave it unless this release needs
                  more of the app.
                </>
              )}
            </Hint>

            <FieldLabel>Delivery</FieldLabel>
            <InstructionHint>
              What devices already in the field do with this release. A patch
              version is a fix — devices on this lineage take it wholesale; a
              wider version is a course update — offered, or for new users
              only.
            </InstructionHint>
            <SeverityGroup>
              {subtypeOptions.map(option => (
                <SeverityButton
                  key={option}
                  $on={effectiveSubtype === option}
                  title={DELIVERY_HELP[option]}
                  onClick={() => setUpdateSubtype(option)}
                >
                  {DELIVERY_LABEL[option]}
                </SeverityButton>
              ))}
            </SeverityGroup>
            {(effectiveSubtype === 'apology' ||
              effectiveSubtype === 'rules' ||
              effectiveSubtype === 'offer') && (
              <>
                <FieldLabel>Update message</FieldLabel>
                <Notes
                  rows={2}
                  value={updateMessage}
                  placeholder={
                    effectiveSubtype === 'apology'
                      ? 'The apology the learner reads'
                      : effectiveSubtype === 'rules'
                        ? 'What changed in the rules'
                        : 'The pitch on the offer sheet'
                  }
                  onChange={event => setUpdateMessage(event.target.value)}
                />
              </>
            )}

          </>
        )}

        {errors.length > 0 && (
          <Errors>
            {errors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </Errors>
        )}

        <Actions>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <Spacer />
          <PrimaryButton
            disabled={busy || diff == null || nothingToRelease || noteMissing}
            title={
              noteMissing ? 'A change note is required by settings' : undefined
            }
            onClick={() => void release()}
          >
            {busy ? 'Releasing…' : `Release ${version}`}
          </PrimaryButton>
        </Actions>
      </Dialog>
    </Backdrop>
  );
};

export default ReleaseModal;

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
  width: 520px;
  max-height: 82vh;
  overflow: auto;
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

const Muted = styled.p`
  margin: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const Summary = styled.div`
  background: ${admin.bg};
  border-radius: 10px;
  padding: 10px 13px;
  margin-bottom: 14px;
`;

const SummaryRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 2px 0;
`;

const Label = styled.span`
  width: 62px;
  flex: none;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${admin.dim2};
  padding-top: 2px;
`;

const Value = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${admin.body};
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 14px;
  cursor: pointer;

  input {
    margin-top: 2px;
  }
`;

const ToggleText = styled.span`
  font-size: 12.5px;
  color: ${admin.body};
`;

const ToggleHint = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: ${admin.dim};
`;

const FieldLabel = styled.span`
  display: block;
  margin: 12px 0 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${admin.dim2};
`;

const VersionInput = styled.input`
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
  margin: 6px 0 0;
  font-size: 11.5px;
  font-weight: 600;
  color: ${admin.accent};
`;

const Notes = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: ${admin.body};
  border: 1px solid ${admin.line};
  border-radius: 9px;
  padding: 8px 10px;
  outline: none;
  resize: vertical;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const InstructionHint = styled.p`
  margin: -2px 0 8px;
  font-size: 11px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const SeverityGroup = styled.div`
  display: flex;
  background: ${admin.hair};
  border-radius: 8px;
  padding: 2px;
`;

const SeverityButton = styled.button<{ $on: boolean }>`
  padding: 3px 9px;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $on }) => ($on ? admin.ink : admin.dim)};
  background: ${({ $on }) => ($on ? admin.surface : 'transparent')};
  box-shadow: ${({ $on }) => ($on ? '0 1px 2px rgba(0,0,0,.12)' : 'none')};
`;

const Errors = styled.ul`
  margin: 14px 0 0;
  padding-left: 18px;
  font-size: 11.5px;
  line-height: 1.6;
  font-weight: 600;
  color: #b91c1c;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 18px;
`;
