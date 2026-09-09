import React from 'react';
import { createRoot } from 'react-dom/client';

import RendererSmoke from '../src/RendererSmoke';

// Mounts the shared card renderer into a real document for the Phase-2 gate.
const container = document.createElement('div');
document.body.appendChild(container);
createRoot(container).render(<RendererSmoke />);
