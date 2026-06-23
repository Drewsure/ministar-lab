// ============================================================================
// Game-by-game freeze smoke test
// ============================================================================
// For each of the 17 games: launch, click the correct answer 3 times in a row
// (to trigger level 2 + streak 3 effects), then check if the game loop is
// still running. Reports any freezes (loop frame not advancing).
// ============================================================================

const puppeteer = require('puppeteer');

const GAMES = [
  { id: 'maze-chase', name: 'Maze Chase', button: '🧭 Maze Chase' },
  { id: 'quiz', name: 'Quiz', button: '❓ Quiz' },
  { id: 'airplane', name: 'Airplane', button: '✈️ Airplane' },
  { id: 'gameshow', name: 'Gameshow', button: '🎯 Gameshow' },
  { id: 'memory-match', name: 'Memory Match', button: '🃏 Memory Match' },
  { id: 'match-up', name: 'Match Up', button: '🔗 Match Up' },
  { id: 'balloon-pop', name: 'Balloon Pop', button: '🎈 Balloon Pop' },
  { id: 'whack-a-mole', name: 'Whack-a-Mole', button: '🔨 Whack-a-Mole' },
  { id: 'anagram', name: 'Anagram', button: '🔤 Anagram' },
  { id: 'wordsearch', name: 'Word Search', button: '🔍 Word Search' },
  { id: 'bridge-builder', name: 'Bridge Builder', button: '🚀 Bridge Builder' },
  { id: 'crossword', name: 'Crossword', button: '🔤 Crossword' },
  { id: 'flash-cards', name: 'Flash Cards', button: '📇 Flash Cards' },
  { id: 'spin-wheel', name: 'Spin Wheel', button: '🎡 Spin Wheel' },
  { id: 'group-sort', name: 'Group Sort', button: '🗃️ Group Sort' },
  { id: 'type-answer', name: 'Type Answer', button: '⌨️ Type Answer' },
  { id: 'spot-it', name: 'Spot It', button: '👁️ Spot It!' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const results = [];
  for (const game of GAMES) {
    const result = { game: game.id, status: 'unknown', details: '' };
    try {
      // Go home
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      // Clear console
      await page.evaluate(() => console.clear());

      // Find and click the game button
      const clicked = await page.evaluate((buttonText) => {
        const buttons = [...document.querySelectorAll('button')];
        const btn = buttons.find(b => b.textContent.includes(buttonText));
        if (btn) { btn.click(); return true; }
        return false;
      }, game.button);
      if (!clicked) {
        result.status = 'FAIL'; result.details = 'Button not found';
        results.push(result); continue;
      }

      // Wait for loading + game to start
      await new Promise(r => setTimeout(r, 3500));

      // Check the game is running
      const init = await page.evaluate(() => {
        const game = window.__PHASER_GAME;
        if (!game) return { error: 'NO GAME' };
        const scene = game.scene.scenes[0];
        return {
          sceneKey: scene?.scene?.key,
          loopFrame: game.loop?.frame,
          children: scene?.children?.length,
        };
      });
      if (init.error) {
        result.status = 'FAIL'; result.details = init.error;
        results.push(result); continue;
      }

      // Try clicking in the center of the canvas a few times to answer
      // (most games have answer options in the center area)
      const beforeFrame = init.loopFrame;
      const canvas = await page.$('canvas');
      if (canvas) {
        const box = await canvas.boundingBox();
        // Click in a few spots to try to answer correctly
        for (let i = 0; i < 5; i++) {
          // Click upper-center (where many games put the correct answer)
          await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
          await new Promise(r => setTimeout(r, 500));
          // Click lower-center
          await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
          await new Promise(r => setTimeout(r, 500));
        }
      }
      await new Promise(r => setTimeout(r, 2000));

      // Check if the loop is still advancing
      const after = await page.evaluate(() => {
        const game = window.__PHASER_GAME;
        if (!game) return { error: 'NO GAME' };
        return {
          loopFrame: game.loop?.frame,
          loopRunning: game.loop?.running,
          sceneStatus: game.scene.scenes[0]?.sys?.settings?.status,
          children: game.scene.scenes[0]?.children?.length,
        };
      });
      if (after.error) {
        result.status = 'FAIL'; result.details = 'Game disappeared: ' + after.error;
        results.push(result); continue;
      }

      const frameDelta = (after.loopFrame ?? 0) - (beforeFrame ?? 0);
      if (frameDelta < 30) {
        result.status = 'FREEZE';
        result.details = `Loop stuck: ${beforeFrame} → ${after.loopFrame} (delta ${frameDelta})`;
      } else if (after.sceneStatus === undefined || after.sceneStatus > 5) {
        result.status = 'WARN';
        result.details = `Scene status ${after.sceneStatus}, frame ${after.loopFrame}`;
      } else {
        result.status = 'PASS';
        result.details = `Frames ${beforeFrame} → ${after.loopFrame} (delta ${frameDelta}), children ${init.children} → ${after.children}`;
      }
    } catch (e) {
      result.status = 'ERROR'; result.details = e.message.slice(0, 100);
    }
    results.push(result);
    console.log(`[${result.status.padEnd(6)}] ${game.id.padEnd(15)} ${result.details}`);
  }

  await browser.close();

  // Summary
  console.log('\n=== SUMMARY ===');
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR').length;
  const freezes = results.filter(r => r.status === 'FREEZE').length;
  const warns = results.filter(r => r.status === 'WARN').length;
  console.log(`PASS: ${passes}  FREEZE: ${freezes}  WARN: ${warns}  FAIL/ERROR: ${fails}  Total: ${results.length}`);
})();
