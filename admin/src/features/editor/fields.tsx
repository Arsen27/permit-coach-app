import styled from 'styled-components';

import { admin } from '@admin/styles/theme';

// The editor's inputs. They are deliberately chrome-less: an editable lesson
// should read as the lesson, not as a form, so a field only announces itself
// on focus.

export const focusRing = `
  outline: 1.5px dashed rgba(4, 133, 247, 0.45);
  outline-offset: 3px;
  border-radius: 3px;
`;

export const TitleInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: ${admin.ink};
  border: none;
  padding: 0 0 7px;
  outline: none;
  background: transparent;

  &:focus {
    ${focusRing}
  }
`;

export const BodyArea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.65;
  font-weight: 500;
  color: ${admin.body};
  border: none;
  background: transparent;
  padding: 0;
  outline: none;
  resize: vertical;
  margin: 0;

  &:focus {
    ${focusRing}
  }
`;

// A field that is one line tall and grows only as far as its own text needs.
// The sizing is done by a hidden twin holding the same string (`data-value`),
// which both the textarea and the twin are laid over: no measuring, no resize
// observers, and no reflow while typing. The twin's trailing space keeps a line
// that ends in a newline from collapsing.
export const AutoGrow = styled.div`
  display: grid;
  flex: 1;
  min-width: 0;

  &::after {
    content: attr(data-value) ' ';
    visibility: hidden;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  & > textarea,
  &::after {
    grid-area: 1 / 1 / 2 / 2;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.65;
    font-weight: 500;
    padding: 0;
    border: none;
    margin: 0;
  }

  & > textarea {
    color: ${admin.body};
    background: transparent;
    outline: none;
    resize: none;
    overflow: hidden;

    &::placeholder {
      color: ${admin.dim2};
    }

    &:focus {
      ${focusRing}
    }
  }
`;

export const SmallInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim};
  border: none;
  background: transparent;
  padding: 0;
  outline: none;

  &::placeholder {
    color: ${admin.dim};
    opacity: 0.6;
  }

  &:focus {
    ${focusRing}
  }
`;

export const SmallButton = styled.button`
  flex: none;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  color: ${admin.body};
  background: ${admin.bg};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${admin.hair};
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

export const DashedButton = styled.button`
  padding: 6px 10px;
  border: 1.5px dashed ${admin.line};
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 700;
  color: ${admin.dim2};
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${admin.accent};
    color: ${admin.accent};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export const Select = styled.select`
  font-family: inherit;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${admin.body};
  background: ${admin.bg};
  border: 1px solid ${admin.line3};
  border-radius: 6px;
  padding: 3px 6px;
  cursor: pointer;
  max-width: 190px;
`;

export const FieldLabel = styled.span`
  font: 600 8.5px ${admin.mono};
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${admin.dim2};
`;

export const Warning = styled.p`
  margin: 6px 0 0;
  font-size: 10.5px;
  font-weight: 600;
  color: #b45309;
`;
