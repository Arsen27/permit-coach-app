import React from 'react';
import styled from 'styled-components';

import type { DiffRun } from '@admin/model/diff';
import { runsForSide } from '@admin/model/diff';
import { admin } from '@admin/styles/theme';

// Renders one text slot with its edits marked, GitHub-style: insertions
// highlighted, deletions struck through, each pane showing only its own side.

type Props = {
  runs: DiffRun[];
  side: 'before' | 'after';
};

const DiffRuns: React.FC<Props> = ({ runs, side }) => (
  <>
    {runsForSide(runs, side).map((run, index) => {
      const content = `${run.words.join(' ')} `;
      if (run.kind === 0) {
        return <React.Fragment key={index}>{content}</React.Fragment>;
      }
      return run.kind < 0 ? (
        <Deleted key={index}>{content}</Deleted>
      ) : (
        <Inserted key={index}>{content}</Inserted>
      );
    })}
  </>
);

export default DiffRuns;

const Inserted = styled.span`
  background: ${admin.diff.insBg};
  color: ${admin.diff.insText};
  border-radius: 3px;
  padding: 0 2px;
`;

const Deleted = styled.span`
  background: ${admin.diff.delBg};
  color: ${admin.diff.delText};
  text-decoration: line-through;
  text-decoration-color: rgba(153, 27, 27, 0.45);
  border-radius: 3px;
  padding: 0 2px;
`;
