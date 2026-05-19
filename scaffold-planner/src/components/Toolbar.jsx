import React, { useRef } from 'react';

export default function Toolbar({ isInternal, state, activeView, activeFace, renderMode, showBom, onToggleBom, dispatch, onLoad, onOpenQuote }) {
  const fileRef = useRef(null);

  function handleSave() {
    const { history, ...saveable } = state;
    const blob = new Blob([JSON.stringify(saveable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raven-scaffold-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleLoadClick() {
    fileRef.current?.click();
  }

  function setView(view, face) {
    dispatch({ type: 'SET_ACTIVE_VIEW', value: view });
    dispatch({ type: 'SET_ACTIVE_FACE', value: face });
  }

  return (
    <header className="toolbar">
      <div className="toolbar-logo">
        <span className="logo-raven">RAVEN</span>
        <span className="logo-staging"> STAGING — </span>
        <span className="logo-tool">SCAFFOLD PLANNER</span>
        {isInternal && <span className="logo-badge">INTERNAL</span>}
      </div>

      <nav className="toolbar-actions">
        <a
          href="https://ravenstaging.co.uk"
          className="toolbar-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          ← HOMEPAGE
        </a>

        <div className="toolbar-sep" />

        <button
          className={`toolbar-btn${renderMode === 'skeleton' ? ' is-active' : ''}`}
          onClick={() => dispatch({ type: 'SET_RENDER_MODE', value: 'skeleton' })}
        >
          SKELETON
        </button>
        <button
          className={`toolbar-btn${renderMode === 'clad' ? ' is-active' : ''}`}
          onClick={() => dispatch({ type: 'SET_RENDER_MODE', value: 'clad' })}
        >
          CLAD
        </button>

        <div className="toolbar-sep" />

        <button
          className={`toolbar-btn${activeView === 'plan' ? ' is-active' : ''}`}
          onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', value: 'plan' })}
        >
          PLAN
        </button>

        <div style={{ display: 'flex' }}>
          <button
            className={`toolbar-btn${activeView === 'front' && activeFace === 'N' ? ' is-active' : ''}`}
            style={{ borderRadius: '3px 0 0 3px' }}
            onClick={() => setView('front', 'N')}
          >
            FRONT
          </button>
          <button
            className={`toolbar-btn${activeView === 'front' && activeFace === 'S' ? ' is-active' : ''}`}
            style={{ borderRadius: '0 3px 3px 0', marginLeft: -1 }}
            onClick={() => setView('front', 'S')}
          >
            BACK
          </button>
        </div>

        <div style={{ display: 'flex' }}>
          <button
            className={`toolbar-btn${activeView === 'side' && activeFace === 'W' ? ' is-active' : ''}`}
            style={{ borderRadius: '3px 0 0 3px' }}
            onClick={() => setView('side', 'W')}
          >
            SIDE L
          </button>
          <button
            className={`toolbar-btn${activeView === 'side' && activeFace === 'E' ? ' is-active' : ''}`}
            style={{ borderRadius: '0 3px 3px 0', marginLeft: -1 }}
            onClick={() => setView('side', 'E')}
          >
            SIDE R
          </button>
        </div>

        <div className="toolbar-sep" />

        <button
          className="toolbar-btn"
          onClick={() => dispatch({ type: 'UNDO' })}
        >
          UNDO
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            if (window.confirm('Clear all? This cannot be undone.')) {
              dispatch({ type: 'CLEAR' });
            }
          }}
        >
          CLEAR
        </button>
        <button className="toolbar-btn" onClick={handleSave}>SAVE</button>
        <button className="toolbar-btn" onClick={handleLoadClick}>LOAD</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={onLoad}
        />

        <div className="toolbar-sep" />

        <button
          className={`toolbar-btn${showBom ? ' is-active' : ''}`}
          onClick={onToggleBom}
        >
          ↑ SCHEDULE
        </button>
        <button className="toolbar-btn" onClick={() => window.print()}>
          PRINT SCHEDULE
        </button>

        {isInternal && (
          <button className="toolbar-btn toolbar-btn--accent" onClick={onOpenQuote}>
            SEND QUOTE
          </button>
        )}
      </nav>
    </header>
  );
}
