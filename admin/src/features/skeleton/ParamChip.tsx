import React from 'react';
import styled from 'styled-components';

import type { ParameterEntry } from '@admin/api/types';
import { admin } from '@admin/styles/theme';

// A {{placeholder}} in skeleton text, drawn as what it is: a variable, not
// prose. Reading a skeleton card as baked text is the mistake this view exists
// to prevent — every number and every state name a learner eventually sees is
// one of these, resolved per state at build time.
//
// Hovering says what each state fills in, which is the fastest way to see that
// a parameter is missing in one of them.

const PLACEHOLDER = /\{\{([A-Za-z][\w.]*)\}\}/g;

export const parameterTitle = (
  key: string,
  entry: ParameterEntry | undefined,
): string => {
  if (entry == null) {
    return `${key} — no state defines this`;
  }
  return entry.states
    .map(state =>
      !state.defined
        ? `${state.stateCode}: not defined`
        : state.value == null
        ? `${state.stateCode}: null (the sentence is dropped)`
        : `${state.stateCode}: ${state.value}`,
    )
    .join('  ·  ');
};

type Props = {
  text: string;
  parameters: Map<string, ParameterEntry>;
};

// Splits one string into prose and chips. Returns a fragment so it can stand
// in anywhere the card renderer accepts a node.
export const ParamText: React.FC<Props> = ({ text, parameters }) => {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    const at = match.index ?? 0;
    if (at > cursor) {
      parts.push(text.slice(cursor, at));
    }
    const key = match[1];
    const entry = parameters.get(key);
    const missing = entry == null || entry.states.some(state => !state.defined);
    parts.push(
      <Chip
        key={`${key}-${at}`}
        data-param={key}
        $missing={missing}
        title={parameterTitle(key, entry)}
      >
        {key}
      </Chip>,
    );
    cursor = at + match[0].length;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
};

export const hasParameters = (text: string): boolean =>
  new RegExp(PLACEHOLDER.source).test(text);

// Every placeholder key in a piece of text, in order.
export const parameterKeys = (text: string): string[] =>
  [...text.matchAll(PLACEHOLDER)].map(match => match[1]);

const Chip = styled.span<{ $missing: boolean }>`
  display: inline-flex;
  align-items: center;
  vertical-align: baseline;
  margin: 0 1px;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid
    ${({ $missing }) =>
      $missing ? 'rgba(220,38,38,.4)' : 'rgba(4,133,247,.32)'};
  background: ${({ $missing }) =>
    $missing ? 'rgba(220,38,38,.09)' : admin.accentSoft};
  color: ${({ $missing }) => ($missing ? '#B91C1C' : '#0369A1')};
  font: 600 11px ${admin.mono};
  letter-spacing: -0.1px;
  cursor: help;
`;
