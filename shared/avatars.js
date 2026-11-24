export const AVATAR_GROUPS = [
  { id: 'wizarding', label: 'Wizarding world' },
  { id: 'animals', label: 'Animals' },
];

export const AVATARS = [
  { id: 'wizard', emoji: '🧙', label: 'Wizard', group: 'wizarding', bg: '#7c5cff' },
  { id: 'witch', emoji: '🧙‍♀️', label: 'Witch', group: 'wizarding', bg: '#a16bff' },
  { id: 'owl', emoji: '🦉', label: 'Owl', group: 'wizarding', bg: '#9c7444' },
  { id: 'serpent', emoji: '🐍', label: 'Serpent', group: 'wizarding', bg: '#2f9e6b' },
  { id: 'lion', emoji: '🦁', label: 'Lion', group: 'wizarding', bg: '#d99a1f' },
  { id: 'badger', emoji: '🦡', label: 'Badger', group: 'wizarding', bg: '#8a7550' },
  { id: 'eagle', emoji: '🦅', label: 'Eagle', group: 'wizarding', bg: '#5a86c9' },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn', group: 'wizarding', bg: '#e567a8' },
  { id: 'dragon', emoji: '🐉', label: 'Dragon', group: 'wizarding', bg: '#3f9e5a' },
  { id: 'vampire', emoji: '🧛', label: 'Vampire', group: 'wizarding', bg: '#b44a5e' },
  { id: 'fox', emoji: '🦊', label: 'Fox', group: 'animals', bg: '#e07b3a' },
  { id: 'panda', emoji: '🐼', label: 'Panda', group: 'animals', bg: '#6b7280' },
  { id: 'koala', emoji: '🐨', label: 'Koala', group: 'animals', bg: '#8a9bb0' },
  { id: 'tiger', emoji: '🐯', label: 'Tiger', group: 'animals', bg: '#d98922' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin', group: 'animals', bg: '#3b82a8' },
  { id: 'frog', emoji: '🐸', label: 'Frog', group: 'animals', bg: '#57a84b' },
  { id: 'octopus', emoji: '🐙', label: 'Octopus', group: 'animals', bg: '#c25a7c' },
  { id: 'monkey', emoji: '🐵', label: 'Monkey', group: 'animals', bg: '#a97b4a' },
  { id: 'rabbit', emoji: '🐰', label: 'Rabbit', group: 'animals', bg: '#b9a6c9' },
  { id: 'cat', emoji: '🐱', label: 'Cat', group: 'animals', bg: '#c99a4e' },
];

export const DEFAULT_AVATAR = 'wizard';

const BY_ID = new Map(AVATARS.map((avatar) => [avatar.id, avatar]));

export function getAvatar(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_AVATAR);
}

export function isAvatarId(id) {
  return typeof id === 'string' && BY_ID.has(id);
}

export function randomAvatarId() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
}

export function avatarsByGroup(group) {
  return AVATARS.filter((avatar) => avatar.group === group);
}
