import React from 'react';
import { createRoot } from 'react-dom/client';

import App from '../src/App';

// Entry for the headless UI check: the whole panel, mounted into a real DOM.
const container = document.createElement('div');
container.id = 'root';
document.body.appendChild(container);
createRoot(container).render(<App />);
