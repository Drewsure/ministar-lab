import React from 'react';
import PhaserGame from './game/scenes/PhaserGame';

function App() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      backgroundColor: '#0f0f1a', 
      minHeight: '100vh', 
      color: '#fff', 
      fontFamily: 'sans-serif' 
    }}>
      <header style={{ padding: '20px', textAlign: 'center' }}>
        <h1 style={{ color: '#6366f1', margin: 0 }}>MiniStar Global Lab</h1>
        <p style={{ color: '#888', margin: '5px 0 0 0' }}>Pairing Engine v1.0</p>
      </header>
      
      <div style={{ width: '100%', maxWidth: '800px', aspectRatio: '4/3', border: '1px solid #333', borderRadius: '16px', overflow: 'hidden' }}>
        <PhaserGame />
      </div>
    </div>
  );
}

export default App;
