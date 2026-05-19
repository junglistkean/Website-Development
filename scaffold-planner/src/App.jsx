import React, { useState, useEffect } from 'react';
import { ScaffoldProvider, useScaffold } from './state/scaffoldStore';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import BomPanel from './components/BomPanel';

function AppInner({ isInternal }) {
  const { state, dispatch } = useScaffold();
  const [showBom, setShowBom] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        dispatch({ type: 'UNDO' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  function handleLoad(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const loaded = JSON.parse(ev.target.result);
        const required = ['gridCols', 'gridRows', 'bayLengths', 'bayWidth', 'levels'];
        if (!required.every(k => k in loaded)) {
          alert('Invalid scaffold plan file — missing required fields.');
          return;
        }
        dispatch({ type: 'LOAD_STATE', payload: loaded });
      } catch {
        alert('Invalid scaffold plan file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="app-shell">
      <Toolbar
        isInternal={isInternal}
        state={state}
        activeView={state.activeView}
        activeFace={state.activeFace}
        renderMode={state.renderMode}
        showBom={showBom}
        onToggleBom={() => setShowBom(v => !v)}
        dispatch={dispatch}
        onLoad={handleLoad}
        onOpenQuote={() => setShowQuoteModal(true)}
      />
      <StatusBar state={state} />
      <div className="app-body">
        <Sidebar state={state} dispatch={dispatch} />
        <Canvas state={state} dispatch={dispatch} />
        <BomPanel
          state={state}
          isInternal={isInternal}
          visible={showBom}
          showQuoteModal={showQuoteModal}
          onOpenQuote={() => setShowQuoteModal(true)}
          onCloseQuote={() => setShowQuoteModal(false)}
        />
      </div>
    </div>
  );
}

export default function App({ isInternal }) {
  return (
    <ScaffoldProvider>
      <AppInner isInternal={isInternal} />
    </ScaffoldProvider>
  );
}
