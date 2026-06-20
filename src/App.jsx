import React, { useState } from 'react';
import PhaserGame from './game/scenes/PhaserGame';
import TeacherDashboard from './TeacherDashboard';

function App() {
  const [theme, setTheme] = useState({ name: 'Default School', bg: '#1e1b4b', card: '#6366f1', accent: '#ffffff' });
  const [view, setView] = useState('teacher'); // 'teacher' or 'student'
  const [gameData, setGameData] = useState(null);

  const switchTheme = (newTheme) => {
    setTheme(newTheme);
    const game = window.phaserGame;
    if (game) {
      game.registry.set('theme', newTheme);
      game.scene.scenes[0].scene.restart();
    }
  };

  const handleCommit = (terms) => {
    setGameData(terms);
    setView('student');
    // Pass data to Phaser registry
    const game = window.phaserGame;
    if (game) {
      game.registry.set('gameData', terms);
      game.scene.scenes[0].scene.restart();
    }
  };

  const btnStyle = { padding: '10px 20px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', margin: '0 5px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: theme.bg, minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', transition: 'background-color 0.3s' }}>
      <header style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)' }}>
        <h1 style={{ color: theme.card, margin: 0 }}>{theme.name}</h1>
        <div>
          <button style={btnStyle} onClick={() => setView('teacher')}>Teacher View</button>
          <button style={btnStyle} onClick={() => setView('student')}>Student View</button>
          <button style={btnStyle} onClick={() => switchTheme({ name: 'Default School', bg: '#1e1b4b', card: '#6366f1', accent: '#ffffff' })}>Default</button>
          <button style={btnStyle} onClick={() => switchTheme({ name: 'Space Academy', bg: '#042f2e', card: '#22d3ee', accent: '#ffffff' })}>Space</button>
        </div>
      </header>

      {view === 'teacher' ? (
        <div style={{ marginTop: '40px' }}>
          <TeacherDashboard onCommit={handleCommit} />
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '800px', aspectRatio: '4/3', border: `2px solid ${theme.card}`, borderRadius: '16px', overflow: 'hidden', marginTop: '20px' }}>
          <PhaserGame />
        </div>
      )}
    </div>
  );
}

export default App;