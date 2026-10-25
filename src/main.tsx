import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { loadPrefs } from './lib/store';
import { applyAccent } from './lib/theme';

// theme and text size before the first paint, so nothing flashes
const prefs = loadPrefs();
applyAccent(prefs.accent);
document.documentElement.dataset.size = prefs.large ? 'large' : 'normal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
