// Queen Mama LITE - Overlay Window Entry Point

import React from 'react';
import ReactDOM from 'react-dom/client';
import OverlayWindow from '../components/overlay/OverlayWindow';
import '../styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayWindow />
  </React.StrictMode>
);
