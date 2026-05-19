import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import App from './App.jsx';

const rootEl = document.getElementById('root');
const isInternal = rootEl.dataset.internal === 'true';

createRoot(rootEl).render(
  <StrictMode>
    <App isInternal={isInternal} />
  </StrictMode>,
);
