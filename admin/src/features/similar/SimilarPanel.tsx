import React from 'react';
import styled from 'styled-components';

import { IconButton, Mono, Spacer } from '@admin/features/shell/ui';
import { toneColor } from '@admin/features/viewer/CardView';
import { useSimilar } from '@admin/store/similarStore';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

// Matches from the reference course, listed beside the lesson so a decision can
// be made without losing the passage that prompted the search.

type Props = {
  referenceLabel: string;
  onOpen: (lessonId: string, cardIndex: number) => void;
};

const SimilarPanel: React.FC<Props> = ({ referenceLabel, onOpen }) => {
  const status = useSimilar(state => state.status);
  const query = useSimilar(state => state.query);
  const results = useSimilar(state => state.results);
  const source = useSimilar(state => state.source);
  const model = useSimilar(state => state.model);
  const note = useSimilar(state => state.note);
  const error = useSimilar(state => state.error);
  const setRightDock = useUi(state => state.setRightDock);

  return (
    <Panel data-panel="similar">
      <Head>
        <Title>Similar in {referenceLabel}</Title>
        <Spacer />
        <IconButton title="Close" onClick={() => setRightDock(null)}>
          ✕
        </IconButton>
      </Head>

      <Body>
        {query.length > 0 && (
          <Query>
            Query: “{query.length > 90 ? `${query.slice(0, 90)}…` : query}”
          </Query>
        )}

        {status === 'searching' && <Muted>searching…</Muted>}
        {status === 'error' && <Error>{error}</Error>}
        {status === 'done' && results.length === 0 && (
          <Muted>No similar content found.</Muted>
        )}
        {status === 'idle' && (
          <Muted>
            Select text in a lesson and use Find similar, or right-click the
            selection, to see where the reference course covers it.
          </Muted>
        )}

        {results.map(result => (
          <Result
            key={`${result.lessonId}-${result.cardIndex}`}
            onClick={() => onOpen(result.lessonId, result.cardIndex)}
          >
            <ResultHead>
              <Kicker $color={toneColor('accent')}>{result.cardType}</Kicker>
              <ResultTitle>{result.lessonTitle}</ResultTitle>
              <Spacer />
              <Mono $size={10} $weight={600}>
                {Math.round(result.score * 100)}%
              </Mono>
            </ResultHead>
            <Bar>
              <BarFill
                style={{ width: `${Math.round(result.score * 100)}%` }}
              />
            </Bar>
            {result.reason != null && <Reason>{result.reason}</Reason>}
            <Snippet>{result.snippet}</Snippet>
          </Result>
        ))}
      </Body>

      {(source != null || note != null) && (
        <Foot>
          {note ??
            `Ranked by ${model} · card ${results.length > 0 ? 'matches' : ''}`}
        </Foot>
      )}
    </Panel>
  );
};

export default SimilarPanel;

const Panel = styled.aside`
  flex: none;
  width: 310px;
  background: ${admin.soft};
  border-left: 1px solid ${admin.line2};
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const Head = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 14px 11px;
  border-bottom: 1px solid ${admin.line2};
`;

const Title = styled.span`
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: -0.1px;
  color: ${admin.ink};
`;

const Body = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 13px;
  display: flex;
  flex-direction: column;
  gap: 9px;
`;

const Query = styled.p`
  margin: 0;
  font-size: 11px;
  font-weight: 500;
  color: ${admin.dim};
`;

const Muted = styled.p`
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.dim2};
  text-wrap: pretty;
`;

const Error = styled(Muted)`
  color: #b91c1c;
`;

const Result = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid ${admin.line3};
  border-radius: 11px;
  padding: 10px 13px;
  background: ${admin.surface};
  cursor: pointer;
  font-family: inherit;

  &:hover {
    border-color: ${admin.accent};
    background: #f7faff;
  }
`;

const ResultHead = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 4px;
  color: ${admin.dim};
`;

const Kicker = styled.span<{ $color: string }>`
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
`;

const ResultTitle = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.ink};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
`;

const Bar = styled.div`
  height: 3px;
  border-radius: 2px;
  background: ${admin.hair};
  overflow: hidden;
  margin-bottom: 6px;
`;

const BarFill = styled.div`
  height: 100%;
  background: ${admin.accent};
`;

const Reason = styled.p`
  margin: 0 0 4px;
  font-size: 10.5px;
  font-weight: 700;
  color: ${admin.accent};
`;

const Snippet = styled.p`
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.muted};
`;

const Foot = styled.div`
  flex: none;
  padding: 9px 13px;
  border-top: 1px solid ${admin.line2};
  font: 500 10px ${admin.mono};
  color: ${admin.dim2};
`;
