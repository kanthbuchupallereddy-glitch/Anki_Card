export interface DemoDeck { id: string; name: string; subject: string; due: number; new: number }
export interface DemoCard { id: string; deck: string; question: string; answer: string; detail: string }

export const demoDecks: readonly DemoDeck[] = [
  { id: 'medicine', name: 'Medicine', subject: 'Human biology & clinical foundations', due: 112, new: 12 },
  { id: 'japanese', name: 'Japanese', subject: 'Language & everyday expressions', due: 48, new: 8 },
  { id: 'design', name: 'Design History', subject: 'Movements, people & ideas', due: 26, new: 4 },
];

export const demoCards: readonly DemoCard[] = [
  { id: 'm1', deck: 'medicine', question: 'Which chamber of the heart pumps blood into the systemic circulation?', answer: 'The left ventricle.', detail: 'It ejects oxygenated blood into the aorta.' },
  { id: 'm2', deck: 'medicine', question: 'What is the functional unit of the kidney?', answer: 'The nephron.', detail: 'Each nephron filters blood and modifies the filtrate through reabsorption and secretion.' },
  { id: 'm3', deck: 'medicine', question: 'Which molecule carries most oxygen in human blood?', answer: 'Hemoglobin.', detail: 'Hemoglobin in red blood cells binds oxygen reversibly.' },
  { id: 'j1', deck: 'japanese', question: 'What does 「ありがとう」 mean?', answer: 'Thank you.', detail: 'Arigatō is a common expression of thanks.' },
  { id: 'j2', deck: 'japanese', question: 'How do you read 「水」?', answer: 'みず — mizu.', detail: 'The word means “water.”' },
  { id: 'd1', deck: 'design', question: 'Who founded the Bauhaus in 1919?', answer: 'Walter Gropius.', detail: 'The school opened in Weimar, Germany, bringing art, craft, and design into a shared educational program.' },
];

export const demoDeckName = (id: string) => demoDecks.find(deck => deck.id === id)?.name ?? 'All decks';
