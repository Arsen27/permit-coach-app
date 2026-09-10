import React from 'react';
import styled from 'styled-components';

import { IconButton, PrimaryButton, Spacer } from '@admin/features/shell/ui';
import { buildPromptText, copyText } from '@admin/model/promptText';
import type { PromptContext } from '@admin/model/promptText';
import { usePrompt } from '@admin/store/promptStore';
import { useUi } from '@admin/store/uiStore';
import { describeAnchor } from '@admin/model/excerptAnchor';
import { admin } from '@admin/styles/theme';

// Collected excerpts with a note each, copied out as one request. Every
// excerpt keeps the version and lesson it came from so the model is told what
// it is looking at.

type Props = { context: PromptContext };

const PromptPanel: React.FC<Props> = ({ context }) => {
  const chunks = usePrompt(state => state.chunks);
  const overallNote = usePrompt(state => state.overallNote);
  const setNote = usePrompt(state => state.setNote);
  const remove = usePrompt(state => state.remove);
  const setOverallNote = usePrompt(state => state.setOverallNote);
  const clear = usePrompt(state => state.clear);

  const setRightDock = useUi(state => state.setRightDock);
  const showToast = useUi(state => state.showToast);

  const copy = async () => {
    const ok = await copyText(buildPromptText(chunks, overallNote, context));
    showToast(
      ok
        ? `Prompt copied · ${chunks.length} excerpt${
            chunks.length === 1 ? '' : 's'
          }`
        : 'Copy failed — select the text manually',
    );
  };

  return (
    <Panel data-panel="prompt">
      <Head>
        <Title>Prompt builder</Title>
        <Spacer />
        <Count>
          {chunks.length} excerpt{chunks.length === 1 ? '' : 's'}
        </Count>
        <IconButton title="Close" onClick={() => setRightDock(null)}>
          ✕
        </IconButton>
      </Head>

      <Body>
        {chunks.length === 0 && (
          <Empty>
            Select any text in a lesson and right-click to add it here. Each
            excerpt keeps its version and lesson reference; add your own
            instruction under it, then copy the whole thing as one prompt.
          </Empty>
        )}

        <List>
          {chunks.map((chunk, index) => (
            <Card key={chunk.id}>
              <CardHead>
                <Index>{String(index + 1).padStart(2, '0')}</Index>
                <Source title={chunk.source}>{chunk.source}</Source>
                {chunk.anchor != null && (
                  <Where
                    title={`${chunk.anchor.blockId} · ${describeAnchor(
                      chunk.anchor,
                    )}`}
                  >
                    {describeAnchor(chunk.anchor)}
                  </Where>
                )}
                <IconButton title="Remove" onClick={() => remove(chunk.id)}>
                  ✕
                </IconButton>
              </CardHead>
              <Quote>{chunk.text}</Quote>
              <Note
                rows={2}
                value={chunk.note}
                placeholder="What should change here?"
                onChange={event => setNote(chunk.id, event.target.value)}
              />
            </Card>
          ))}
        </List>

        <OverallLabel>Overall instructions</OverallLabel>
        <Overall
          rows={4}
          value={overallNote}
          placeholder="e.g. Rewrite for 8th-grade reading level, keep all numeric values"
          onChange={event => setOverallNote(event.target.value)}
        />
      </Body>

      <Foot>
        <Clear onClick={clear}>Clear</Clear>
        <Spacer />
        <PrimaryButton
          disabled={chunks.length === 0}
          onClick={() => void copy()}
        >
          Copy prompt
        </PrimaryButton>
      </Foot>
    </Panel>
  );
};

export default PromptPanel;

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

const Count = styled.span`
  font: 600 10px ${admin.mono};
  color: ${admin.dim2};
`;

const Body = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 13px;
`;

const Empty = styled.p`
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.dim2};
  text-wrap: pretty;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 9px;
`;

const Card = styled.div`
  background: ${admin.surface};
  border: 1px solid ${admin.line3};
  border-radius: 11px;
  padding: 10px 12px;
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
`;

const Index = styled.span`
  font: 600 9.5px ${admin.mono};
  color: ${admin.ghost};
`;

const Source = styled.span`
  flex: 1;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: ${admin.dim};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Quote = styled.p`
  margin: 0 0 8px;
  padding-left: 9px;
  border-left: 2px solid ${admin.line};
  font-size: 11.5px;
  line-height: 1.55;
  font-weight: 500;
  color: ${admin.muted};
  text-wrap: pretty;
`;

const field = `
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 11.5px;
  line-height: 1.5;
  font-weight: 500;
  color: #3f3f46;
  border: 1px solid #e9e9eb;
  border-radius: 8px;
  padding: 7px 9px;
  outline: none;
  resize: vertical;
`;

const Note = styled.textarea`
  ${field}

  &:focus {
    border-color: ${admin.accent};
  }
`;

const OverallLabel = styled.span`
  display: block;
  margin: 14px 0 5px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${admin.dim2};
`;

const Overall = styled.textarea`
  ${field}
  background: ${admin.surface};
  border-radius: 9px;
  padding: 8px 10px;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const Foot = styled.div`
  flex: none;
  display: flex;
  gap: 8px;
  padding: 11px 13px;
  border-top: 1px solid ${admin.line2};
`;

const Clear = styled.button`
  padding: 7px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.dim};
  cursor: pointer;

  &:hover {
    background: #efeff1;
  }
`;

// Where the excerpt sits, shown beside its source so the operator can see what
// the request will claim before it is copied out.
const Where = styled.span`
  font: 600 9.5px ${admin.mono};
  color: ${admin.faint};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
