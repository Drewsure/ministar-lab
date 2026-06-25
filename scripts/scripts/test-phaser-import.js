// Test Phaser 3 ESM import
import('phaser').then(PhaserModule => {
  const Phaser = PhaserModule.default ?? PhaserModule;
  console.log('Phaser version:', Phaser.VERSION);
  console.log('Has Game:', !!Phaser.Game);
  console.log('Has AUTO:', Phaser.AUTO);
  console.log('Has Scene:', !!Phaser.Scene);
}).catch(e => console.error('Import error:', e.message));
