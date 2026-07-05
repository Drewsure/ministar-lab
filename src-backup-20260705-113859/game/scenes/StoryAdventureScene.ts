import * as Phaser from 'phaser';
import { BaseEngine } from '../BaseEngine';
import { audioBus } from '../../lib/audio';
import type { TermItem } from '../../lib/types';

// STORY ADVENTURE — Branching narrative game (Life is Strange inspired)
// Student reads a chapter, chooses what happens next.
// Each choice reinforces a vocabulary word.

interface StoryChoice { text: string; vocab: string; consequence: string; next: string; }
interface StoryChapter { id: string; title: string; narrative: string; choices: StoryChoice[]; }

const CHAPTERS: StoryChapter[] = [
  {
    id: 'ch1', title: 'A New Morning',
    narrative: 'You wake up to the sound of your alarm. It is morning. The sun shines through your window. You need to get ready for school. What do you do?',
    choices: [
      { text: 'Eat breakfast in the kitchen', vocab: 'breakfast', consequence: 'You feel energized and ready to learn!', next: 'ch2' },
      { text: 'Rush to the classroom without eating', vocab: 'classroom', consequence: 'Your stomach growls. Maybe you should have eaten!', next: 'ch2' },
    ],
  },
  {
    id: 'ch2', title: 'At School',
    narrative: 'You arrive at school. Your teacher greets you with a smile. Today you will learn new words. The teacher asks you to work with a partner.',
    choices: [
      { text: 'Work with your best friend', vocab: 'friend', consequence: 'You and your friend complete the assignment perfectly!', next: 'ch3' },
      { text: 'Work alone in the library', vocab: 'library', consequence: 'You finish the assignment, but it was more fun with a friend.', next: 'ch3' },
    ],
  },
  {
    id: 'ch3', title: 'Lunch Time',
    narrative: 'The bell rings for lunch. You are very hungry! In the cafeteria, you see many foods. What do you want to eat?',
    choices: [
      { text: 'I want to eat my favorite food', vocab: 'favorite', consequence: 'Your favorite food is delicious! You feel happy.', next: 'ch4' },
      { text: 'I want to try something new', vocab: 'new', consequence: 'You try a new food. It is interesting! You learned something new.', next: 'ch4' },
    ],
  },
  {
    id: 'ch4', title: 'After School',
    narrative: 'School is over. You have homework to do tonight. Your friend asks what you want to do this weekend. What is your answer?',
    choices: [
      { text: 'I want to finish my homework first', vocab: 'homework', consequence: 'Responsible choice! You enjoy your weekend stress-free.', next: 'ending' },
      { text: 'My favorite activity is playing outside', vocab: 'weekend', consequence: 'Fresh air and exercise! Great choice for the weekend.', next: 'ending' },
    ],
  },
  {
    id: 'ending', title: 'A Good Day',
    narrative: 'You had a wonderful day at school. You learned new words, made good choices, and spent time with friends. Every morning is a new adventure!',
    choices: [
      { text: 'My favorite part was learning new words', vocab: 'morning', consequence: 'You earned the Word Explorer badge!', next: 'END' },
      { text: 'My favorite part was spending time with my friend', vocab: 'friend', consequence: 'You earned the Friendship badge!', next: 'END' },
    ],
  },
];

export default class StoryAdventureScene extends BaseEngine {
  private currentChapterId = 'ch1';
  private vocabLearned = new Set<string>();
  private choicesMade: string[] = [];
  private narrativeText!: Phaser.GameObjects.Text;
  private narrativeBg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  private feedbackText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private canAct = true;

  protected maxQuestions() { return CHAPTERS.reduce((sum, ch) => sum + ch.choices.length, 0); }

  protected buildWorld() {
    this.add.text(this.scale.width / 2, 35, '📖 Story Adventure', {
      fontFamily: 'Inter, sans-serif', fontSize: '22px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    // Progress
    this.progressText = this.add.text(this.scale.width / 2, 60, 'Words learned: 0', {
      fontFamily: 'Inter, sans-serif', fontSize: '13px', color: this.hex(this.theme.textMuted),
    }).setOrigin(0.5).setDepth(50);

    // Chapter title
    this.titleText = this.add.text(this.scale.width / 2, 100, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '20px', color: this.hex(this.theme.warning), fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.titleText);

    // Narrative card
    this.narrativeBg = this.add.rectangle(this.scale.width / 2, 200, this.scale.width - 40, 120, this.theme.card, 0.85)
      .setStrokeStyle(2, this.theme.accent, 0.4).setDepth(48);
    this.narrativeText = this.add.text(this.scale.width / 2, 200, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: this.hex(this.theme.text),
      align: 'center', wordWrap: { width: this.scale.width - 80 }, lineSpacing: 4,
    }).setOrigin(0.5).setDepth(49);
    this.makeSpeakable(this.narrativeText);

    // Feedback
    this.feedbackText = this.add.text(this.scale.width / 2, 460, '', {
      fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5).setDepth(30);

    this._renderChapter();

    this.setupGlobalPointer((x, y) => {
      if (!this.canAct) return;
      for (let i = 0; i < this.choiceButtons.length; i++) {
        const btn = this.choiceButtons[i];
        if (Math.abs(x - btn.x) < 250 && Math.abs(y - btn.y) < 25) {
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
    this.titleText.setText(chapter.title);
    this.narrativeText.setText(chapter.narrative);
    this.makeSpeakable(this.narrativeText, chapter.narrative);
    this.feedbackText.setText('');

    // Speak the narrative
    this.time.delayedCall(500, () => {
      if (!this.isFinished) audioBus.speak(chapter.narrative);
    });

    // Clear old buttons
    this.choiceButtons.forEach(b => { try { b.destroy(); } catch {} });
    this.choiceButtons = [];

    const startY = 340;
    chapter.choices.forEach((choice, i) => {
      const y = startY + i * 55;
      const bg = this.add.rectangle(0, 0, 500, 44, this.theme.card, 0.9).setStrokeStyle(2, this.theme.accent, 0.5);
      const txt = this.add.text(0, 0, choice.text, {
        fontFamily: 'Inter, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const container = this.add.container(this.scale.width / 2, y, [bg, txt]).setSize(500, 44).setDepth(40);
      this.makeSpeakable(txt, choice.text);
      this.choiceButtons.push(container);
    });
  }

  private _handleChoice(idx: number) {
    if (!this.canAct) return;
    this.canAct = false;
    const chapter = CHAPTERS.find(c => c.id === this.currentChapterId);
    if (!chapter) return;
    const choice = chapter.choices[idx];

    this.vocabLearned.add(choice.vocab);
    this.choicesMade.push(choice.text);
    this.progressText.setText(`Words learned: ${this.vocabLearned.size}`);

    this.recordAnswer({
      term: choice.vocab, response: choice.text, success: true,
      coordinate: { x: this.scale.width / 2, y: 400, t: this.time.now },
    });

    this.feedbackText.setText(`✓ ${choice.consequence}`);
    audioBus.speak(choice.consequence);
    this.juice.burst(this.scale.width / 2, 400, 'correct');

    // Disable buttons
    this.choiceButtons.forEach(b => {
      const bg = b.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(this.theme.cardAlt, 0.5);
    });

    this.time.delayedCall(2500, () => {
      if (this.isFinished) return;
      this.currentChapterId = choice.next;
      this._renderChapter();
    });
  }
}
