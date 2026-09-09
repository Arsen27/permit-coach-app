import React, { useMemo, useState } from 'react';
import styled from 'styled-components';

import type { ParameterCatalogue, StateParamValue } from '@admin/api/types';
import { Select, SmallButton, SmallInput } from '@admin/features/editor/fields';
import { admin } from '@admin/styles/theme';

// The parameters, per state.
//
// A parameter is the only way a number reaches a shared card, so this is where
// most of the difference between two states actually lives. The server refuses
// a value the builder would refuse — every digit has to be stated by the rule
// cited — and the rule's own numbers are shown beside the field so the refusal
// is rarely a surprise.
//
// A null value is not a gap to be filled in later: it means the state does not
// codify the rule, the sentence using it is dropped from that state's card, and
// the status is `not_codified` rather than `needs_review`.

type Props = {
  catalogue: ParameterCatalogue;
  saving: boolean;
  refusal: string[] | null;
  onSave: (stateCode: string, key: string, param: StateParamValue) => void;
};

const ParametersPanel: React.FC<Props> = ({
  catalogue,
  saving,
  refusal,
  onSave,
}) => {
  const [stateCode, setStateCode] = useState(
    catalogue.states[0]?.stateCode ?? '',
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<StateParamValue>({ value: null });
  const [filter, setFilter] = useState('');

  const rules = catalogue.catalogues[stateCode]?.rules ?? [];
  const numbersOf = useMemo(
    () => new Map(rules.map(rule => [rule.ruleId, rule.numbers])),
    [rules],
  );

  const rows = catalogue.parameters
    .filter(entry => entry.key.includes(filter))
    .map(entry => ({
      entry,
      here: entry.states.find(state => state.stateCode === stateCode),
    }));

  const begin = (key: string, current: (typeof rows)[number]['here']) => {
    setEditing(key);
    setDraft({
      value: current?.value ?? null,
      ...(current?.rule != null && { rule: current.rule }),
      ...(current?.status != null && { status: current.status }),
    });
  };

  return (
    <Panel data-parameters-panel={stateCode}>
      <Head>
        <Title>Parameters</Title>
        <Select
          value={stateCode}
          aria-label="State"
          onChange={event => setStateCode(event.target.value)}
        >
          {catalogue.states.map(state => (
            <option key={state.stateCode} value={state.stateCode}>
              {state.stateCode}
            </option>
          ))}
        </Select>
      </Head>
      <SmallInput
        value={filter}
        placeholder="Filter"
        aria-label="Filter parameters"
        onChange={event => setFilter(event.target.value)}
      />

      <Rows>
        {rows.map(({ entry, here }) => (
          <Row key={entry.key} data-param-row={entry.key}>
            <RowHead onClick={() => begin(entry.key, here)}>
              <Key>{entry.key}</Key>
              <Value $null={here?.value == null}>
                {here?.value == null ? 'not codified' : String(here.value)}
              </Value>
            </RowHead>
            <Uses>
              used in {entry.uses.length} place
              {entry.uses.length === 1 ? '' : 's'}
              {here?.rule != null && ` · ${here.rule}`}
              {here?.status != null && ` · ${here.status}`}
            </Uses>

            {editing === entry.key && (
              <Editor>
                <Field>
                  <FieldName>value</FieldName>
                  <SmallInput
                    value={draft.value == null ? '' : String(draft.value)}
                    aria-label={`${entry.key} value`}
                    placeholder="empty = not codified"
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        value:
                          event.target.value.trim().length === 0
                            ? null
                            : /^-?\d+(\.\d+)?$/.test(event.target.value.trim())
                            ? Number(event.target.value)
                            : event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldName>unit</FieldName>
                  <SmallInput
                    value={draft.unit ?? ''}
                    aria-label={`${entry.key} unit`}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        unit: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldName>rule</FieldName>
                  <Select
                    value={draft.rule ?? ''}
                    aria-label={`${entry.key} rule`}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        rule: event.target.value,
                      }))
                    }
                  >
                    <option value="">— none —</option>
                    {rules.map(rule => (
                      <option key={rule.ruleId} value={rule.ruleId}>
                        {rule.ruleId}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <FieldName>status</FieldName>
                  <Select
                    value={draft.status ?? ''}
                    aria-label={`${entry.key} status`}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="">— unset —</option>
                    <option value="verified">verified</option>
                    <option value="needs_review">needs_review</option>
                    <option value="not_codified">not_codified</option>
                  </Select>
                </Field>

                {draft.rule != null && draft.rule.length > 0 && (
                  <Numbers>
                    {draft.rule} states:{' '}
                    {(numbersOf.get(draft.rule) ?? []).join(', ') ||
                      'no numbers'}
                  </Numbers>
                )}

                {refusal != null && (
                  <Refusal>
                    {refusal.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </Refusal>
                )}

                <Actions>
                  <SmallButton
                    disabled={saving}
                    onClick={() => onSave(stateCode, entry.key, draft)}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </SmallButton>
                  <SmallButton onClick={() => setEditing(null)}>
                    Cancel
                  </SmallButton>
                </Actions>
              </Editor>
            )}
          </Row>
        ))}
      </Rows>
    </Panel>
  );
};

export default ParametersPanel;

const Panel = styled.aside`
  flex: none;
  width: 320px;
  border-left: 1px solid ${admin.line};
  background: ${admin.surface};
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  gap: 8px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: ${admin.muted};
`;

const Rows = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Row = styled.div`
  padding: 6px 4px;
  border-bottom: 1px solid ${admin.hair};
`;

const RowHead = styled.button`
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
`;

const Key = styled.span`
  flex: 1;
  font: 600 11px ${admin.mono};
  color: ${admin.body};
`;

const Value = styled.span<{ $null: boolean }>`
  font: 700 11px ${admin.mono};
  color: ${({ $null }) => ($null ? admin.faint : admin.ink)};
`;

const Uses = styled.p`
  margin: 2px 0 0;
  font-size: 9.5px;
  color: ${admin.faint};
`;

const Editor = styled.div`
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Field = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FieldName = styled.span`
  width: 52px;
  font: 600 9.5px ${admin.mono};
  color: ${admin.dim2};
`;

const Numbers = styled.p`
  margin: 0;
  font: 500 9.5px ${admin.mono};
  color: ${admin.faint};
  line-height: 1.5;
`;

const Refusal = styled.ul`
  margin: 0;
  padding-left: 16px;
  font-size: 10.5px;
  line-height: 1.5;
  color: #b91c1c;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
`;
