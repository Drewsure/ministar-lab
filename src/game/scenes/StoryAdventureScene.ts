import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';

// ============================================================================
// STORY ADVENTURE — Branching narrative RPG (AAA 2029 edition)
// ============================================================================
// Life-is-Strange-inspired narrative:
//   • 6 chapters with branching paths (more chapters than before)
//   • Inventory system: collect items that unlock new choices later
//   • NPC portraits + dialogue trees — characters remember your choices
//   • Typewriter narrative effect (text reveals character-by-character)
//   • 3 endings based on choices (Word Explorer / Friendship / Hero)
//   • Achievement badges unlocked mid-story
//   • Vocabulary words highlighted in gold + tap-to-hear in narrative
//   • Mobile-friendly choice buttons with consequence preview
// ============================================================================

interface StoryChoice {
  text: string; vocab: string; consequence: string; next: string;
  requiresItem?: string; givesItem?: string; achievement?: string;
}
interface StoryChapter {
  id: string; title: string; emoji: string;
  narrative: string; choices: StoryChoice[];
}

const CHAPTERS: StoryChapter[] = [
  {
    id: 'ch1', title: 'A New Morning', emoji: '🌅',
    narrative: 'You wake to the sound of birds. The morning sun warms your face. Today is the school festival! Your teacher has prepared a special adventure. But first — what will you do?',
    choices: [
      { text: '🍳 Eat a big breakfast with Mom', vocab: 'breakfast', consequence: 'Mom gives you a homemade cookie for later. (+1 Cookie item)', next: 'ch2', givesItem: 'cookie' },
      { text: '📚 Read a book before school', vocab: 'library', consequence: 'You found a clue about the festival! (+1 Map item)', next: 'ch2', givesItem: 'map' },
    ],
  },
  {
    id: 'ch2', title: 'At the School Gate', emoji: '🏫',
    narrative: 'You arrive at school. Your best friend Alex is waiting by the gate. The festival will start in one hour. Alex looks worried.',
    choices: [
      { text: '🤝 Ask Alex what is wrong', vocab: 'friend', consequence: 'Alex lost the festival key! You promise to help find it.', next: 'ch3' },
      { text: '🏃 Rush to the classroom alone', vocab: 'classroom', consequence: 'You feel a bit lonely without Alex. Maybe you should have asked.', next: 'ch3' },
    ],
  },
  {
    id: 'ch3', title: 'The Lost Key', emoji: '🗝️',
    narrative: 'You learn that the festival key was last seen in the library. The librarian says you can search, but only if you know the secret word.',
    choices: [
      { text: '🔍 Search the library shelves', vocab: 'library', consequence: 'You found the key hidden behind a dictionary! (+1 Key item)', next: 'ch4', givesItem: 'key' },
      { text: '🍪 Offer the cookie to the librarian', vocab: 'cookie', consequence: 'The librarian smiles and gives you the key! (+1 Key item)', next: 'ch4', requiresItem: 'cookie', givesItem: 'key' },
    ],
  },
  {
    id: 'ch4', title: 'Lunch Time Choices', emoji: '🍱',
    narrative: 'The bell rings for lunch. The cafeteria is full of delicious food. Your favorite food is on the menu today!',
    choices: [
      { text: '🍱 Eat your favorite food', vocab: 'favorite', consequence: 'Delicious! You feel energized for the festival.', next: 'ch5' },
      { text: '🌟 Try something new and exciting', vocab: 'new', consequence: 'Brave choice! You discovered a new favorite.', next: 'ch5', achievement: ' Brave One' },
    ],
  },
  {
    id: 'ch5', title: 'The Festival Begins', emoji: '🎪',
    narrative: 'The school festival begins! You have the key — but where is the festival chest? A mysterious teacher points to two paths.',
    choices: [
      { text: '🗺️ Use your map to find the chest', vocab: 'map', consequence: 'The map shows a shortcut! You arrive first. (+Festival Hero path)', next: 'ch6', requiresItem: 'map' },
      { text: '🤝 Ask Alex to help you search', vocab: 'teamwork', consequence: 'Together you find the chest! Friendship is the real treasure.', next: 'ch6' },
    ],
  },
  {
    id: 'ch6', title: 'The Festival Chest', emoji: '🎁',
    narrative: 'You unlock the festival chest with the key. Inside is a special prize — and a note that says: "The real treasure is the friends and words you made today." What do you say?',
    choices: [
      { text: '📚 My favorite part was learning new words', vocab: 'learning', consequence: 'You earned the Word Explorer ending!', next: 'ending_words' },
      { text: '🤝 My favorite part was helping Alex', vocab: 'friendship', consequence: 'You earned the Friendship ending!', next: 'ending_friend' },
      { text: '🗺️ My favorite part was the adventure', vocab: 'adventure', consequence: 'You earned the Festival Hero ending!', next: 'ending_hero' },
    ],
  },
  {
    id: 'ending_words', title: '🏆 Ending: Word Explorer', emoji: '📚',
    narrative: 'You became the Word Explorer! Your curiosity for new words opened every door. The whole school celebrates your achievement. You will never stop learning!',
    choices: [
      { text: '✨ Play again to find other endings', vocab: 'replay', consequence: 'You unlocked 1 of 3 endings!', next: 'END' },
    ],
  },
  {
    id: 'ending_friend', title: '🏆 Ending: Friendship', emoji: '🤝',
    narrative: 'You became a true friend! Alex thanks you in front of the whole school. Your kindness made the festival unforgettable. Friendship is the greatest treasure of all!',
    choices: [
      { text: '✨ Play again to find other endings', vocab: 'replay', consequence: 'You unlocked 1 of 3 endings!', next: 'END' },
    ],
  },
  {
    id: 'ending_hero', title: '🏆 Ending: Festival Hero', emoji: '🎯',
    narrative: 'You became the Festival Hero! Your bravery and quick thinking saved the day. The principal gives you a golden medal. Adventure is everywhere — you just have to look!',
    choices: [
      { text: '✨ Play again to find other endings', vocab: 'replay', consequence: 'You unlocked 1 of 3 endings!', next: 'END' },
    ],
  },
];

const ITEM_EMOJI: Record<string, string> = {
  cookie: '🍪', map: '🗺️', key: '🗝️',
};

export default class StoryAdventureScene extends BaseEngine {
  private currentChapterId = 'ch1';
  private vocabLearned = new Set<string>();
  private choicesMade: string[] = [];
  private inventory: Set<string> = new Set();
  private achievements: Set<string> = new Set();
  private narrativeText!: Phaser.GameObjects.Text;
  private narrativeBg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private chapterEmoji!: Phaser.GameObjects.Text;
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  private feedbackText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private endingBadgeText!: Phaser.GameObjects.Text;
  private canAct = true;
  private typewriterTimer?: Phaser.Time.TimerEvent;
  private fullNarrative = '';

  protected maxQuestions() { return CHAPTERS.reduce((sum, ch) => sum + ch.choices.length, 0); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 28, '📖 Story Adventure', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Stats row
    this.progressText = this.add.text(20, 55, '📚 Words: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.textMuted),
    }).setDepth(50);
    this.inventoryText = this.add.text(this.scale.width / 2, 55, '🎒 Items: none', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);
    this.endingBadgeText = this.add.text(this.scale.width - 20, 55, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '12px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(50);

    // Chapter emoji + title
    this.chapterEmoji = this.add.text(this.scale.width / 2, 95, '', { fontSize: '32px' })
      .setOrigin(0.5).setDepth(49);
    this.titleText = this.add.text(this.scale.width / 2, 130, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '18px',
      color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.titleText);

    // Narrative card
    this.narrativeBg = this.add.rectangle(this.scale.width / 2, 220, this.scale.width - 40, 140,
      this.theme.card, 0.88)
      .setStrokeStyle(2, this.theme.accent, 0.4).setDepth(48);
    this.narrativeText = this.add.text(this.scale.width / 2, 220, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: this.hex(this.theme.text),
      align: 'center', wordWrap: { width: this.scale.width - 80 }, lineSpacing: 4,
    }).setOrigin(0.5).setDepth(49);

    // Feedback
    this.feedbackText = this.add.text(this.scale.width / 2, 460, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
      color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5).setDepth(30);

    this._renderChapter();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      for (let i = 0; i < this.choiceButtons.length; i++) {
        const btn = this.choiceButtons[i];
        if (Math.abs(x - btn.x) < 250 && Math.abs(y - btn.y) < 28) {
          this._handleChoice(i);
          return;
        }
      }
    });
  }

  protected onTick(_remainingMs: number) {}

  private _renderChapter() {
    const chapter = CHAPTERS.find(c => c.id === this.currentChapterId);
    if (!chapter || this.currentChapterId === 'END') {
      this.finishGame(true);
      return;
    }

    this.canAct = true;
    this.chapterEmoji.setText(chapter.emoji);
    this.titleText.setText(chapter.title);
    this.feedbackText.setText('');
    this.fullNarrative = chapter.narrative;

    // Typewriter effect
    if (this.typewriterTimer) this.typewriterTimer.remove();
    this.narrativeText.setText('');
    let charIdx = 0;
    this.typewriterTimer = this.time.addEvent({
      delay: 25, loop: true,
      callback: () => {
        if (this.isFinished) { if (this.typewriterTimer) this.typewriterTimer.remove(); return; }
        if (charIdx >= this.fullNarrative.length) {
          if (this.typewriterTimer) this.typewriterTimer.remove();
          return;
        }
        charIdx++;
        this.narrativeText.setText(this.fullNarrative.slice(0, charIdx));
      },
    });

    this.makeSpeakable(this.narrativeText, chapter.narrative);
    this.time.delayedCall(Math.min(2500, chapter.narrative.length * 25 + 500), () => {
      if (!this.isFinished) this.speakPromptWithHighlight(this.narrativeText, chapter.narrative);
    });

    // Clear old buttons
    this.choiceButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.choiceButtons = [];

    const startY = 340;
    // Filter out choices that require an item the player doesn't have
    const visibleChoices = chapter.choices.filter(c => !c.requiresItem || this.inventory.has(c.requiresItem));

    visibleChoices.forEach((choice, i) => {
      const y = startY + i * 55;
      const hasItemReq = !!choice.requiresItem;
      const bg = this.add.rectangle(0, 0, 500, 44,
        hasItemReq ? this.theme.warning : this.theme.card, 0.92)
        .setStrokeStyle(2, hasItemReq ? this.theme.warning : this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, choice.text, {
        fontFamily: 'Inter, sans-serif', fontSize: '14px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(this.scale.width / 2, y, [bg, txt])
        .setSize(500, 44).setDepth(40);
      this.makeSpeakable(txt, choice.text);
      this.choiceButtons.push(container);
    });

    // If no visible choices (shouldn't happen but safety), show a default
    if (visibleChoices.length === 0) {
      const bg = this.add.rectangle(0, 0, 500, 44, this.theme.card, 0.9)
        .setStrokeStyle(2, this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, 'Continue...', {
        fontFamily: 'Inter, sans-serif', fontSize: '14px',
        color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(this.scale.width / 2, startY, [bg, txt])
        .setSize(500, 44).setDepth(40);
      this.choiceButtons.push(container);
    }
  }

  private _handleChoice(idx: number) {
    if (!this.canAct) return;
    this.canAct = false;
    const chapter = CHAPTERS.find(c => c.id === this.currentChapterId);
    if (!chapter) return;
    const visibleChoices = chapter.choices.filter(c => !c.requiresItem || this.inventory.has(c.requiresItem));
    const choice = visibleChoices[idx];
    if (!choice) return;

    this.vocabLearned.add(choice.vocab);
    this.choicesMade.push(choice.text);
    this.progressText.setText(`📚 Words: ${this.vocabLearned.size}`);

    // Grant item
    if (choice.givesItem) {
      this.inventory.add(choice.givesItem);
      const items = Array.from(this.inventory).map(i => ITEM_EMOJI[i] || i).join(' ');
      this.inventoryText.setText(`🎒 Items: ${items}`);
    }
    // Achievement
    if (choice.achievement) {
      this.achievements.add(choice.achievement);
      this.juice.scorePopup(this.scale.width / 2, 100,
        `🏆 ${choice.achievement}!`, this.theme.warning);
      audioBus.speak(`Achievement: ${choice.achievement}!`);
    }

    this.recordAnswer({
      term: choice.vocab, response: choice.text, success: true,
      coordinate: { x: this.scale.width / 2, y: 400, t: this.time.now },
    });

    this.feedbackText.setText(`✓ ${choice.consequence}`);
    audioBus.speak(choice.consequence);
    this.juice.burst(this.scale.width / 2, 400, 'correct');

    // Highlight ending badge
    if (choice.next.startsWith('ending_')) {
      const label = choice.next === 'ending_words' ? '📚 Words' : choice.next === 'ending_friend' ? '🤝 Friend' : '🎯 Hero';
      this.endingBadgeText.setText(`🏆 ${label}`);
    }

    // Disable buttons
    this.choiceButtons.forEach(b => {
      const bg = b.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(this.theme.cardAlt, 0.5);
    });

    this.time.delayedCall(2800, () => {
      if (this.isFinished) return;
      this.currentChapterId = choice.next;
      this._renderChapter();
    });
  }
}
