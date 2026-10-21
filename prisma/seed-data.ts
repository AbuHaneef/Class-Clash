// ClassClash seed structure: education levels, grades, subjects, topics,
// badges, missions and demo guardian bots (Nigerian curriculum launch).

export const LEVELS = [
  { name: "Primary", slug: "primary", order: 1 },
  { name: "Junior Secondary", slug: "junior-secondary", order: 2 },
  { name: "Senior Secondary", slug: "senior-secondary", order: 3 },
];

export const GRADES: {
  name: string;
  slug: string;
  level: string;
  order: number;
  hasContent: boolean;
}[] = [
  { name: "Primary 1", slug: "primary-1", level: "primary", order: 1, hasContent: false },
  { name: "Primary 2", slug: "primary-2", level: "primary", order: 2, hasContent: false },
  { name: "Primary 3", slug: "primary-3", level: "primary", order: 3, hasContent: false },
  { name: "Primary 4", slug: "primary-4", level: "primary", order: 4, hasContent: false },
  { name: "Primary 5", slug: "primary-5", level: "primary", order: 5, hasContent: false },
  { name: "Primary 6", slug: "primary-6", level: "primary", order: 6, hasContent: true },
  { name: "JSS 1", slug: "jss-1", level: "junior-secondary", order: 7, hasContent: false },
  { name: "JSS 2", slug: "jss-2", level: "junior-secondary", order: 8, hasContent: true },
  { name: "JSS 3", slug: "jss-3", level: "junior-secondary", order: 9, hasContent: true },
  { name: "SS 1", slug: "ss-1", level: "senior-secondary", order: 10, hasContent: false },
  { name: "SS 2", slug: "ss-2", level: "senior-secondary", order: 11, hasContent: true },
  { name: "SS 3", slug: "ss-3", level: "senior-secondary", order: 12, hasContent: true },
];

export const SUBJECTS: {
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  order: number;
}[] = [
  { name: "Mathematics", slug: "mathematics", icon: "calculator", color: "#f59e0b", description: "Numbers, algebra, geometry, statistics and problem solving.", order: 1 },
  { name: "English Language", slug: "english-language", icon: "book-open", color: "#ec4899", description: "Grammar, vocabulary, comprehension and effective communication.", order: 2 },
  { name: "Basic Science", slug: "basic-science", icon: "microscope", color: "#10b981", description: "Living things, matter, energy and the scientific method.", order: 3 },
  { name: "Basic Technology", slug: "basic-technology", icon: "wrench", color: "#f97316", description: "Tools, materials, drawing and machines.", order: 4 },
  { name: "Civic Education", slug: "civic-education", icon: "scale", color: "#a78bfa", description: "Citizenship, values, rights, duties and democracy.", order: 5 },
  { name: "Social Studies", slug: "social-studies", icon: "globe-2", color: "#14b8a6", description: "Family, culture, community and nation building.", order: 6 },
  { name: "Computer Studies", slug: "computer-studies", icon: "monitor", color: "#06b6d4", description: "Computing basics, software and staying safe online.", order: 7 },
  { name: "Chemistry", slug: "chemistry", icon: "atom", color: "#ef4444", description: "Atoms, bonding, reactions and organic chemistry.", order: 8 },
  { name: "Physics", slug: "physics", icon: "orbit", color: "#c084fc", description: "Motion, energy, electricity and waves.", order: 9 },
  { name: "Biology", slug: "biology", icon: "leaf", color: "#22c55e", description: "Cells, living processes, genetics and ecology.", order: 10 },
  { name: "Economics", slug: "economics", icon: "trending-up", color: "#eab308", description: "Scarcity, markets, money and national economy.", order: 11 },
];

// Which subjects are available per grade (only grades with question content)
export const SUBJECT_GRADES: { grade: string; subjects: string[] }[] = [
  {
    grade: "primary-6",
    subjects: ["mathematics", "english-language", "basic-science", "civic-education"],
  },
  {
    grade: "jss-2",
    subjects: [
      "mathematics",
      "english-language",
      "basic-science",
      "social-studies",
      "civic-education",
    ],
  },
  {
    grade: "jss-3",
    subjects: [
      "mathematics",
      "english-language",
      "basic-science",
      "basic-technology",
      "computer-studies",
    ],
  },
  {
    grade: "ss-2",
    subjects: [
      "mathematics",
      "english-language",
      "chemistry",
      "physics",
      "biology",
    ],
  },
  {
    grade: "ss-3",
    subjects: [
      "mathematics",
      "english-language",
      "chemistry",
      "physics",
      "biology",
      "economics",
    ],
  },
];

export const TOPICS: { subject: string; topics: { name: string; description: string }[] }[] = [
  {
    subject: "mathematics",
    topics: [
      { name: "Number & Operations", description: "Fractions, decimals, percentages, LCM & HCF" },
      { name: "Algebra", description: "Equations, indices, factorisation, variation" },
      { name: "Geometry & Measurement", description: "Shapes, area, perimeter, angles" },
      { name: "Statistics & Probability", description: "Mean, median, mode, chance" },
    ],
  },
  {
    subject: "english-language",
    topics: [
      { name: "Grammar", description: "Tenses, concord, parts of speech" },
      { name: "Vocabulary", description: "Synonyms, antonyms, word forms" },
      { name: "Comprehension & Usage", description: "Idioms, clauses, sentence structure" },
      { name: "Punctuation & Mechanics", description: "Capitalisation, punctuation marks" },
    ],
  },
  {
    subject: "basic-science",
    topics: [
      { name: "Living Things", description: "Cells, plants, animals, classification" },
      { name: "Matter & Materials", description: "States of matter, changes, mixtures" },
      { name: "The Human Body", description: "Body systems, health, reproduction" },
      { name: "Energy & Forces", description: "Energy forms, force, motion, electricity" },
    ],
  },
  {
    subject: "basic-technology",
    topics: [
      { name: "Tools & Materials", description: "Hand tools, materials, fasteners" },
      { name: "Technical Drawing", description: "Orthographic projection, views" },
      { name: "Machines & Energy", description: "Simple machines, power sources" },
      { name: "Workshop Safety", description: "Protective equipment and safe practice" },
    ],
  },
  {
    subject: "civic-education",
    topics: [
      { name: "Values & Citizenship", description: "Good values, citizenship, duties" },
      { name: "Rights & Duties", description: "Human rights and responsibilities" },
      { name: "Democracy & Governance", description: "Rule of law, arms of government" },
    ],
  },
  {
    subject: "social-studies",
    topics: [
      { name: "Family & Society", description: "Family types, marriage, socialisation" },
      { name: "Culture", description: "Norms, traditions, oral tradition" },
      { name: "Community & Nation", description: "Community, nationhood, social problems" },
    ],
  },
  {
    subject: "computer-studies",
    topics: [
      { name: "Computer Basics", description: "Hardware, software, data units" },
      { name: "Internet & Safety", description: "Browsers, staying safe online" },
      { name: "Applications", description: "Word processing, files and formats" },
    ],
  },
  {
    subject: "chemistry",
    topics: [
      { name: "Atomic Structure", description: "Atoms, protons, electrons, isotopes" },
      { name: "Periodic Table", description: "Groups, periods, trends" },
      { name: "Bonding & Reactions", description: "Ionic, covalent, equations, moles" },
      { name: "Organic Chemistry", description: "Hydrocarbons, functional groups" },
    ],
  },
  {
    subject: "physics",
    topics: [
      { name: "Motion & Force", description: "Speed, acceleration, Newton's laws" },
      { name: "Energy & Work", description: "Work, power, kinetic & potential energy" },
      { name: "Electricity", description: "Ohm's law, power, induction" },
      { name: "Waves & Modern Physics", description: "EM waves, radioactivity, nuclear" },
    ],
  },
  {
    subject: "biology",
    topics: [
      { name: "The Cell", description: "Organelles, cell processes" },
      { name: "Living Processes", description: "Nutrition, respiration, transport" },
      { name: "Genetics & Variation", description: "Genes, Mendel, heredity" },
      { name: "Ecology", description: "Food chains, ecosystems, environment" },
    ],
  },
  {
    subject: "economics",
    topics: [
      { name: "Basic Concepts", description: "Scarcity, choice, opportunity cost" },
      { name: "Demand & Supply", description: "Markets, price, equilibrium" },
      { name: "Money & Banking", description: "Inflation, central bank, institutions" },
    ],
  },
];

export const BADGES: {
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  xpReward: number;
  sort: number;
}[] = [
  { code: "first_quiz", name: "First Steps", description: "Complete your first quiz.", icon: "flag", color: "#f59e0b", xpReward: 10, sort: 1 },
  { code: "perfect_score", name: "Flawless", description: "Score 100% in any quiz.", icon: "target", color: "#10b981", xpReward: 25, sort: 2 },
  { code: "personal_best", name: "New Peak", description: "Beat your previous best score.", icon: "trending-up", color: "#ec4899", xpReward: 10, sort: 3 },
  { code: "streak_5", name: "On Fire", description: "Keep a 5-day learning streak.", icon: "flame", color: "#f97316", xpReward: 25, sort: 4 },
  { code: "streak_10", name: "Unstoppable", description: "Keep a 10-day learning streak.", icon: "zap", color: "#eab308", xpReward: 50, sort: 5 },
  { code: "explorer_math", name: "Maths Explorer", description: "Answer 25 Mathematics questions.", icon: "calculator", color: "#f59e0b", xpReward: 15, sort: 6 },
  { code: "explorer_english", name: "Word Wizard", description: "Answer 25 English Language questions.", icon: "book-open", color: "#ec4899", xpReward: 15, sort: 7 },
  { code: "explorer_science", name: "Science Star", description: "Answer 25 science questions.", icon: "microscope", color: "#10b981", xpReward: 15, sort: 8 },
  { code: "arena_10", name: "Arena Regular", description: "Play 10 Quick Arena sessions.", icon: "swords", color: "#c084fc", xpReward: 20, sort: 9 },
  { code: "duel_first", name: "Duel Debut", description: "Play your first duel or champion challenge.", icon: "users", color: "#14b8a6", xpReward: 10, sort: 10 },
  { code: "duel_win_5", name: "Duel Master", description: "Win 5 challenge matches.", icon: "trophy", color: "#eab308", xpReward: 30, sort: 11 },
  { code: "comeback", name: "Comeback Kid", description: "Win a match right after losing one.", icon: "rotate-ccw", color: "#ef4444", xpReward: 15, sort: 12 },
  { code: "champion", name: "Crowned", description: "Become a subject champion.", icon: "crown", color: "#fbbf24", xpReward: 50, sort: 13 },
  { code: "defender", name: "Guardian", description: "Successfully defend your title.", icon: "shield", color: "#a78bfa", xpReward: 25, sort: 14 },
  { code: "daily_7", name: "Daily Devotee", description: "Complete 7 Daily Challenges.", icon: "calendar-check", color: "#06b6d4", xpReward: 25, sort: 15 },
  { code: "level_10", name: "Double Digits", description: "Reach level 10.", icon: "star", color: "#f59e0b", xpReward: 40, sort: 16 },
];

export const MISSIONS: {
  code: string;
  name: string;
  description: string;
  icon: string;
  metric: string;
  target: number;
  xpReward: number;
}[] = [
  { code: "m_questions", name: "Warm Up", description: "Answer 10 questions today", icon: "list-checks", metric: "questions_answered", target: 10, xpReward: 20 },
  { code: "m_practice", name: "Study Time", description: "Complete 1 practice session", icon: "book-open", metric: "practice_complete", target: 1, xpReward: 15 },
  { code: "m_arena", name: "Arena Run", description: "Play 1 Quick Arena match", icon: "zap", metric: "arena_play", target: 1, xpReward: 15 },
  { code: "m_daily", name: "Daily Grind", description: "Complete today's Daily Challenge", icon: "calendar-check", metric: "daily_play", target: 1, xpReward: 25 },
  { code: "m_duel", name: "Bring It On", description: "Play 1 duel or champion challenge", icon: "swords", metric: "duel_play", target: 1, xpReward: 20 },
];

// Demo guardians: clearly-labelled bots that hold the first titles so the
// championship system is playable from day one. Beating one crowns YOU.
export const GUARDIANS: {
  grade: string;
  subject: string;
  name: string;
  skill: number;
  avatar: string;
}[] = [
  { grade: "primary-6", subject: "mathematics", name: "Prime Panda", skill: 0.6, avatar: "panda" },
  { grade: "primary-6", subject: "english-language", name: "Lexi Lion", skill: 0.6, avatar: "lion" },
  { grade: "primary-6", subject: "basic-science", name: "Sparky Squirrel", skill: 0.55, avatar: "squirrel" },
  { grade: "primary-6", subject: "civic-education", name: "Civic Cheetah", skill: 0.55, avatar: "cheetah" },
  { grade: "jss-2", subject: "mathematics", name: "Digit Dolphin", skill: 0.65, avatar: "dolphin" },
  { grade: "jss-2", subject: "english-language", name: "Quill Quokka", skill: 0.6, avatar: "quokka" },
  { grade: "jss-2", subject: "basic-science", name: "Neutron Newt", skill: 0.6, avatar: "newt" },
  { grade: "jss-2", subject: "social-studies", name: "Atlas Antelope", skill: 0.55, avatar: "antelope" },
  { grade: "jss-2", subject: "civic-education", name: "Justice Jaguar", skill: 0.6, avatar: "jaguar" },
  { grade: "jss-3", subject: "mathematics", name: "Sigma Shark", skill: 0.7, avatar: "shark" },
  { grade: "jss-3", subject: "english-language", name: "Prose Pelican", skill: 0.65, avatar: "pelican" },
  { grade: "jss-3", subject: "basic-science", name: "Ion Iguana", skill: 0.65, avatar: "iguana" },
  { grade: "jss-3", subject: "basic-technology", name: "Gizmo Gecko", skill: 0.6, avatar: "gecko" },
  { grade: "jss-3", subject: "computer-studies", name: "Byte Bat", skill: 0.65, avatar: "bat" },
  { grade: "ss-2", subject: "mathematics", name: "Cosine Crow", skill: 0.7, avatar: "crow" },
  { grade: "ss-2", subject: "english-language", name: "Syntax Swan", skill: 0.65, avatar: "swan" },
  { grade: "ss-2", subject: "chemistry", name: "Mole Mongoose", skill: 0.7, avatar: "mongoose" },
  { grade: "ss-2", subject: "physics", name: "Newton Nyala", skill: 0.7, avatar: "nyala" },
  { grade: "ss-2", subject: "biology", name: "Gene Giraffe", skill: 0.65, avatar: "giraffe" },
  { grade: "ss-3", subject: "mathematics", name: "Integral Ibis", skill: 0.75, avatar: "ibis" },
  { grade: "ss-3", subject: "english-language", name: "Rhetoric Raven", skill: 0.7, avatar: "raven" },
  { grade: "ss-3", subject: "chemistry", name: "Alkane Aardvark", skill: 0.75, avatar: "aardvark" },
  { grade: "ss-3", subject: "physics", name: "Photon Pangolin", skill: 0.75, avatar: "pangolin" },
  { grade: "ss-3", subject: "biology", name: "Enzyme Egret", skill: 0.7, avatar: "egret" },
  { grade: "ss-3", subject: "economics", name: "Supply Serval", skill: 0.7, avatar: "serval" },
];

export const AVATARS = [
  "fox", "owl", "panda", "lion", "shark", "cat",
  "turtle", "penguin", "bee", "dragon", "robot", "alien",
];
