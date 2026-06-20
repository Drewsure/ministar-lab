import React, { useState } from 'react';

export default function TeacherDashboard({ onCommit }) {
  const [rawText, setRawText] = useState("Apple, Banana, Cherry, Grape");
  const [terms, setTerms] = useState([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [gameMode, setGameMode] = useState('MemoryMatch'); // New state for game mode

  const extractWithLLM = () => {
    const words = rawText.split(',').map(w => w.trim()).filter(w => w.length > 0);
    const extracted = words.map((word, i) => ({
      id: i + 1,
      term: word,
      emoji: getEmojiForWord(word),
      verified: false
    }));
    setTerms(extracted);
    setVerifiedCount(0);
  };

  const getEmojiForWord = (word) => {
    const map = { Apple: '🍎', Banana: '🍌', Cherry: '🍒', Grape: '🍇' };
    return map[word] || '❓';
  };

  const verifyTerm = (id) => {
    const updated = terms.map(t => t.id === id ? { ...t, verified: !t.verified } : t);
    setTerms(updated);
    setVerifiedCount(updated.filter(t => t.verified).length);
  };

  const btnStyle = {
    padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontSize: '16px', margin: '10px 0'
  };

  return (
    <div style={{ width: '100%', maxWidth: '600px', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', boxSizing: 'border-box' }}>
      <h2>1. Zero-Prep AI Authoring</h2>
      <p>Paste raw chapter text here:</p>
      <textarea 
        value={rawText} 
        onChange={(e) => setRawText(e.target.value)} 
        style={{ width: '100%', height: '80px', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', padding: '10px', boxSizing: 'border-box' }}
      />
      <button style={btnStyle} onClick={extractWithLLM}>AI Extract Terms</button>

      {terms.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Extracted Terms (Verification Required)</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {terms.map(term => (
              <div key={term.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                <span>{term.emoji} {term.term}</span>
                <button 
                  style={{ ...btnStyle, margin: 0, padding: '5px 10px', background: term.verified ? '#10b981' : '#ef4444' }}
                  onClick={() => verifyTerm(term.id)}
                >
                  {term.verified ? '✅ Verified' : 'Map Audio & Verify'}
                </button>
              </div>
            ))}
          </div>
          
          {/* GAME MODE SELECTOR */}
          <div style={{ marginTop: '20px' }}>
            <h3>Select Game Engine</h3>
            <select 
              value={gameMode} 
              onChange={(e) => setGameMode(e.target.value)}
              style={{ width: '100%', padding: '10px', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px' }}
            >
              <option value="MemoryMatch">Memory Match (Pairing Engine)</option>
              <option value="MazeChase">Maze Chase (Physics Selection Engine)</option>
            </select>
          </div>

          <button 
            style={{ ...btnStyle, width: '100%', background: verifiedCount === terms.length ? '#10b981' : '#333', cursor: verifiedCount === terms.length ? 'pointer' : 'not-allowed' }}
            disabled={verifiedCount !== terms.length}
            onClick={() => onCommit({ terms, gameMode })}
          >
            {verifiedCount === terms.length ? 'Commit to Game Engine' : `Verify All Terms (${verifiedCount}/${terms.length})`}
          </button>
        </div>
      )}
    </div>
  );
}