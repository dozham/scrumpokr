export const RANDOM_NAMES = [
  'Cosmic Cheetah', 'Cyber Dragon', 'Neon Phoenix', 'Shadow Griffin', 'Turbo Shark',
  'Phantom Raven', 'Solar Lion', 'Lunar Wolf', 'Atomic Axolotl', 'Galactic Gecko',
  'Digital Dolphin', 'Electric Eagle', 'Mecha Mammoth', 'Quantum Quokka', 'Sonic Sloth',
  'Vortex Viper', 'Alpha Antelope', 'Beta Bear', 'Omega Owl', 'Delta Deer',
  'Iron Iguana', 'Steel Scorpion', 'Bronze Bison', 'Silver Snake', 'Golden Goat',
  'Cinnabar Cat', 'Azure Ape', 'Emerald Eel', 'Ruby Rhino', 'Jade Jaguar',
  'Frozen Falcon', 'Blazing Bull', 'Thunder Tiger', 'Stormy Stag', 'Cloudy Crane',
  'Silent Spider', 'Flying Fish', 'Diving Duck', 'Dancing Dog', 'Prowling Panther',
  'Savage Seal', 'Wild Walrus', 'Raging Ram', 'Primal Puma', 'Ancient Ape',
  'Mystic Manta', 'Magic Magpie', 'Wizard Whale', 'Heroic Hippo', 'Legendary Lemur',
  'Stealthy Squirrel', 'Hidden Hedgehog', 'Secret Swan', 'Masked Moose', 'Cloaked Crow',
  'Hyper Hyena', 'Ultra Urchin', 'Mega Mole', 'Super Snail', 'Turbo Turtle',
  'Glow Worm', 'Star Snail', 'Moon Monkey', 'Sun Spider', 'Space Sparrow',
  'Rocket Rabbit', 'Jet Jellyfish', 'Laser Lizard', 'Plasma Penguin', 'Radar Rat',
  'Nomad Nightingale', 'Vagabond Vulture', 'Outlaw Otter', 'Rebel Robin', 'Rogue Rook',
  'Zen Zebra', 'Chill Chinchilla', 'mellow Meerkat', 'Quiet Quail', 'Peaceful Pigeon',
  'Funky Flamingo', 'Groovy Gorilla', 'Disco Dog', 'Jazz Jackal', 'Blues Bat',
  'Rock Rhino', 'Metal Mouse', 'Pop Panda', 'Indie Ibis', 'Folk Fox',
  'Binary Bee', 'Pixel Pig', 'Logic Lobster', 'Data Dove', 'Code Coyote',
  'Frosty Ferret', 'Misty Moth', 'Dewy Dragonfly', 'Sunny Starfish', 'Windy Wasp',
  'Brave Beetle', 'Bold Butterfly', 'Fast Firefly', 'Smart Scorpion', 'Wise Weaver'
];

export function getRandomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}
