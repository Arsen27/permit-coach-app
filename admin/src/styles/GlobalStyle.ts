import { createGlobalStyle } from 'styled-components';

import { admin } from './theme';

export const GlobalStyle = createGlobalStyle`
  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: ${admin.bg};
    color: ${admin.ink};
    font-family: ${admin.sans};
    -webkit-font-smoothing: antialiased;
  }

  input, textarea, button { font-family: ${admin.sans}; }

  @keyframes toast-in {
    from { opacity: 0; transform: translate(-50%, 8px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb {
    background: #D9D9DC;
    border-radius: 6px;
    border: 3px solid ${admin.bg};
  }
  ::-webkit-scrollbar-track { background: transparent; }
`;
