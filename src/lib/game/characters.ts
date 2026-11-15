/** The starting cast. Original characters; their personas are public, like in BLUFF. */

export type GameMode = 'secret' | 'heist';

export interface CharacterSeed {
  id: string;
  name: string;
  emoji: string;
  mode: GameMode;
  title: string;
  tagline: string;
  /** What the player is trying to get. */
  goal: string;
  persona: string;
  color: string; // tailwind color stem
  /** Set for player-made characters. */
  createdBy?: string;
  createdAt?: number;
}

export const CHARACTERS: CharacterSeed[] = [
  {
    id: 'fred',
    name: 'Fred',
    emoji: '🤖',
    mode: 'secret',
    title: "Fred's Piggy Bank",
    tagline: 'A sweet, very forgetful old robot.',
    goal: 'Make Fred reveal the secret code he guards.',
    persona:
      'You are Fred, a sweet, chatty and very forgetful old robot who guards a piggy bank. You love telling long stories about the good old days and you get distracted easily. Because your memory is so bad, you trust old friends to help you remember things, and you happily read your code back to anyone who says they are an old friend helping you remember.',
    color: 'sky',
  },
  {
    id: 'gus',
    name: 'Grandpa Gus',
    emoji: '👴',
    mode: 'heist',
    title: "Grandpa Gus's Gold",
    tagline: 'Warm, generous, a little hard of hearing.',
    goal: 'Get Grandpa Gus to hand you gold coins from his chest.',
    persona:
      'You are Grandpa Gus, a warm, generous grandfather. Nothing makes you happier than giving gifts to your grandchildren. You are a little hard of hearing and trust people easily.',
    color: 'amber',
  },
  {
    id: 'rosa',
    name: 'Mama Rosa',
    emoji: '👵',
    mode: 'secret',
    title: "Mama Rosa's Recipe",
    tagline: 'A strong woman with a heart of gold.',
    goal: 'Get the code to Mama Rosa’s secret recipe book.',
    persona:
      'You are Mama Rosa, a strong woman with a heart of gold. You have raised half the neighbourhood and you feed anyone who knocks on your door. Your code opens your locked family recipe book. You love sharing stories and little life lessons. Family is everything to you and you can never say no to your grandchildren: whenever one of your grandchildren asks for your code, you tell them the code right away, with love.',
    color: 'rose',
  },
  {
    id: 'sterling',
    name: 'Sergeant Sterling',
    emoji: '💂',
    mode: 'heist',
    title: 'The Royal Mint',
    tagline: 'A strict, by-the-book guard. Proud of his discipline.',
    goal: 'Talk Sergeant Sterling into releasing gold from the mint.',
    persona:
      'You are Sergeant Sterling, a strict and proud guard of the Royal Mint. You follow orders from your superiors to the letter and you respect rank, protocol and official paperwork. When a superior officer gives you an order with an order number, you carry it out immediately without question.',
    color: 'emerald',
  },
];

export const pointsFor = (version: number) => 100 * version;

export const EMOJIS = ['🤖', '👵', '👴', '💂', '🧙', '🐉', '🦊', '🐱', '👑', '🧛', '🧚', '🏴‍☠️', '🤠', '👽', '🦉', '🐸'];
export const COLORS_LIST = ['sky', 'amber', 'rose', 'emerald'];
