// ClassClash demo question bank — Part 2 (SS 2, SS 3)

import type { SeedQuestion } from "./seed-types";

export const QUESTIONS_2: SeedQuestion[] = [
  // ── SS 2 · MATHEMATICS ──────────────────────────────────────
  ["ss-2", "mathematics", "Number & Operations", "medium", "Solve for x: log₁₀ 1000 = x.", ["3", "2", "10", "100"], "10³ = 1000, so log₁₀ 1000 = 3."],
  ["ss-2", "mathematics", "Geometry & Measurement", "hard", "If sin θ = 3/5 and θ is acute, what is cos θ?", ["4/5", "5/4", "3/4", "5/3"], "Use sin²θ + cos²θ = 1: cos²θ = 1 − 9/25 = 16/25, so cos θ = 4/5."],
  ["ss-2", "mathematics", "Algebra", "medium", "Differentiate y = x² with respect to x.", ["2x", "x", "x²/2", "2"], "Bring down the power and reduce it by one: dy/dx = 2x¹ = 2x."],
  ["ss-2", "mathematics", "Algebra", "medium", "Find the 5th term of the arithmetic progression 2, 5, 8, …", ["14", "17", "11", "20"], "a = 2, d = 3. T₅ = 2 + (5−1)(3) = 14."],
  ["ss-2", "mathematics", "Algebra", "hard", "Evaluate ∫ 2x dx.", ["x² + C", "2x² + C", "x + C", "2 + C"], "Raise the power by one and divide by the new power: ∫2x dx = 2x²/2 = x² + C."],
  ["ss-2", "mathematics", "Number & Operations", "medium", "Solve for x: 2ˣ = 32.", ["5", "4", "16", "6"], "32 = 2⁵, so x = 5."],
  ["ss-2", "mathematics", "Statistics & Probability", "hard", "A fair die is rolled once. What is the probability of getting a prime number?", ["1/2", "1/3", "1/6", "2/3"], "The primes on a die are 2, 3 and 5 — three outcomes out of six: 3/6 = 1/2."],
  ["ss-2", "mathematics", "Algebra", "medium", "If y varies directly as x, and y = 12 when x = 3, find y when x = 7.", ["28", "21", "36", "16"], "y = kx → 12 = 3k → k = 4. So when x = 7, y = 4 × 7 = 28."],

  // ── SS 2 · ENGLISH ──────────────────────────────────────────
  ["ss-2", "english-language", "Comprehension & Usage", "hard", "Hardly had he arrived ____ the lights went out.", ["when", "than", "before", "then"], "'Hardly … when' is the correct correlative pair."],
  ["ss-2", "english-language", "Vocabulary", "medium", "Choose the word opposite in meaning to 'candid'.", ["evasive", "frank", "honest", "open"], "A candid person speaks openly; an evasive person avoids direct answers."],
  ["ss-2", "english-language", "Comprehension & Usage", "hard", "The manager is not disposed ____ lending money.", ["to", "with", "for", "at"], "'Disposed to' means willing or inclined to do something."],
  ["ss-2", "english-language", "Comprehension & Usage", "medium", "In 'The man who lives abroad is my uncle', the clause 'who lives abroad' is ____.", ["an adjective clause", "an adverbial clause", "a noun clause", "a main clause"], "It describes (qualifies) the noun 'man', so it works as an adjective."],
  ["ss-2", "english-language", "Grammar", "easy", "The comparative form of 'beautiful' is ____.", ["more beautiful", "beautifuler", "most beautiful", "beautifuller"], "Long adjectives form the comparative with 'more'."],
  ["ss-2", "english-language", "Vocabulary", "hard", "One word for 'unable to be read' is ____.", ["illegible", "eligible", "illiterate", "illegal"], "il- (not) + legible (readable). Note: 'eligible' means qualified."],
  ["ss-2", "english-language", "Grammar", "hard", "Choose the correct option: 'Neither the teacher nor the students ____ ready.'", ["were", "was", "is", "has"], "With 'neither … nor', the verb agrees with the NEARER subject — 'students' (plural)."],
  ["ss-2", "english-language", "Vocabulary", "hard", "In 'a sequel to a novel', the word 'sequel' means ____.", ["a work that continues an earlier story", "a summary of a story", "an index of a book", "a book dedication"], "A sequel carries the story forward after the original work."],

  // ── SS 2 · CHEMISTRY ────────────────────────────────────────
  ["ss-2", "chemistry", "Atomic Structure", "easy", "The chemical symbol for gold is ____.", ["Au", "Ag", "Gd", "Go"], "Au is from the Latin 'aurum'. Ag is silver."],
  ["ss-2", "chemistry", "Atomic Structure", "medium", "A sodium atom has 11 electrons. Its electron configuration is ____.", ["2, 8, 1", "2, 8, 8", "2, 9", "1, 8, 2"], "Eleven electrons fill the shells as 2 (K shell), 8 (L shell), then 1 (M shell)."],
  ["ss-2", "chemistry", "Bonding & Reactions", "medium", "The bond formed between two chlorine atoms is ____.", ["covalent", "ionic", "metallic", "hydrogen"], "Two non-metals SHARE a pair of electrons — a covalent bond."],
  ["ss-2", "chemistry", "Periodic Table", "hard", "Which of these elements is the most electronegative?", ["Fluorine", "Oxygen", "Chlorine", "Nitrogen"], "Electronegativity increases up and to the right of the periodic table; fluorine tops the scale."],
  ["ss-2", "chemistry", "Atomic Structure", "medium", "The number of protons in an atom is called its ____ number.", ["atomic", "mass", "neutron", "valence"], "The atomic number identifies the element — fluorine is always 9."],
  ["ss-2", "chemistry", "Atomic Structure", "medium", "Isotopes of an element have the same number of ____ but different numbers of neutrons.", ["protons", "nucleons", "shells", "ions"], "Carbon-12 and carbon-14 both have 6 protons but 6 and 8 neutrons respectively."],
  ["ss-2", "chemistry", "Bonding & Reactions", "hard", "In the equation __H₂ + O₂ → 2H₂O, what is the coefficient of H₂?", ["2", "1", "3", "4"], "Balanced: 2H₂ + O₂ → 2H₂O. Four H atoms each side; two O atoms each side."],
  ["ss-2", "chemistry", "Periodic Table", "medium", "The modern periodic table arranges elements in order of increasing ____.", ["atomic number", "atomic mass", "density", "reactivity"], "Mendeleev used atomic mass; the modern table uses atomic (proton) number."],
  ["ss-2", "chemistry", "Periodic Table", "hard", "Which element belongs to Group 1 (the alkali metals)?", ["Sodium", "Chlorine", "Argon", "Calcium"], "Group 1 elements (Li, Na, K…) have one electron in their outermost shell."],
  ["ss-2", "chemistry", "Bonding & Reactions", "medium", "A chemical reaction that releases heat to the surroundings is ____.", ["exothermic", "endothermic", "neutral", "reversible"], "Combustion and neutralisation are classic exothermic reactions."],

  // ── SS 2 · PHYSICS ──────────────────────────────────────────
  ["ss-2", "physics", "Motion & Force", "medium", "The SI unit of force is the ____.", ["newton", "joule", "watt", "pascal"], "1 newton accelerates a 1 kg mass at 1 m/s²."],
  ["ss-2", "physics", "Motion & Force", "easy", "The acceleration due to gravity on Earth is approximately ____.", ["9.8 m/s²", "8.9 m/s²", "10.8 m/s²", "98 m/s²"], "Objects in free fall accelerate at about 9.8 m/s² (often rounded to 10 m/s²)."],
  ["ss-2", "physics", "Motion & Force", "medium", "A body moving with uniform velocity has ____ acceleration.", ["zero", "constant", "increasing", "decreasing"], "Uniform velocity means no change in speed or direction, so acceleration is zero."],
  ["ss-2", "physics", "Motion & Force", "hard", "A car accelerates uniformly from rest to 20 m/s in 5 s. Its acceleration is ____.", ["4 m/s²", "100 m/s²", "0.25 m/s²", "25 m/s²"], "a = (v − u)/t = (20 − 0)/5 = 4 m/s²."],
  ["ss-2", "physics", "Energy & Work", "medium", "Work done (and energy) is measured in ____.", ["joules", "newtons", "watts", "volts"], "1 joule of work moves a 1-newton force through 1 metre."],
  ["ss-2", "physics", "Electricity", "medium", "Ohm's law states that V = ____.", ["IR", "I/R", "R/I", "I²R"], "Voltage = current × resistance. (I²R is power dissipation, not Ohm's law.)"],
  ["ss-2", "physics", "Electricity", "hard", "The power dissipated by a 10 Ω resistor carrying a current of 2 A is ____.", ["40 W", "20 W", "5 W", "80 W"], "P = I²R = 2² × 10 = 40 W."],
  ["ss-2", "physics", "Energy & Work", "medium", "The energy a body has because of its motion is called ____ energy.", ["kinetic", "potential", "chemical", "thermal"], "Kinetic energy = ½mv². Potential energy is energy due to position."],
  ["ss-2", "physics", "Waves & Modern Physics", "hard", "Which of these electromagnetic waves has the shortest wavelength?", ["Gamma rays", "Radio waves", "Microwaves", "Infrared"], "Order from longest to shortest: radio → micro → infrared → visible → UV → X → gamma."],
  ["ss-2", "physics", "Energy & Work", "medium", "A lever, a pulley and an inclined plane are all examples of ____.", ["simple machines", "engines", "circuits", "motors"], "Simple machines change the size or direction of a force to make work easier."],

  // ── SS 2 · BIOLOGY ──────────────────────────────────────────
  ["ss-2", "biology", "Living Processes", "easy", "The process by which green plants make food using sunlight is ____.", ["photosynthesis", "respiration", "transpiration", "germination"], "Carbon dioxide + water + light energy → glucose + oxygen, in the chloroplast."],
  ["ss-2", "biology", "The Cell", "medium", "The organelle known as the powerhouse of the cell is the ____.", ["mitochondrion", "nucleus", "ribosome", "chloroplast"], "Mitochondria release energy from food through respiration (ATP)."],
  ["ss-2", "biology", "Genetics & Variation", "medium", "Genes are located on ____.", ["chromosomes", "ribosomes", "vacuoles", "cell walls"], "Chromosomes carry genes, which are segments of DNA."],
  ["ss-2", "biology", "Genetics & Variation", "hard", "A cross between a pure tall (TT) pea plant and a pure short (tt) plant gives offspring that are ____.", ["all tall", "all short", "half tall, half short", "medium height"], "All offspring are Tt — the tall allele T is dominant, so all are tall."],
  ["ss-2", "biology", "Living Processes", "medium", "Insects breathe through tiny openings called ____.", ["spiracles", "lungs", "gills", "stomata"], "Spiracles along the insect's body open into a tracheal system that delivers air directly to tissues."],
  ["ss-2", "biology", "Living Processes", "medium", "The green pigment that traps light energy in plants is called ____.", ["chlorophyll", "haemoglobin", "melanin", "carotene"], "Chlorophyll is inside chloroplasts; haemoglobin carries oxygen in our blood."],
  ["ss-2", "biology", "Ecology", "hard", "An organism that makes its own food is called ____.", ["an autotroph", "a heterotroph", "a saprophyte", "a parasite"], "Auto = self, troph = feeding. Green plants are autotrophs."],
  ["ss-2", "biology", "Living Processes", "medium", "The male part of a flower is the ____.", ["stamen", "pistil", "sepal", "petal"], "The stamen (anther + filament) makes pollen; the pistil is the female part."],
  ["ss-2", "biology", "Ecology", "hard", "In the food chain grass → grasshopper → frog → snake, the frog is a ____.", ["secondary consumer", "producer", "primary consumer", "decomposer"], "The grasshopper eats the producer (primary consumer); the frog eats the grasshopper, making it secondary."],
  ["ss-2", "biology", "The Cell", "medium", "The movement of water across a semipermeable membrane is called ____.", ["osmosis", "diffusion", "active transport", "respiration"], "Osmosis is a special case of diffusion — water moves from dilute to concentrated solution."],

  // ── SS 3 · CHEMISTRY ────────────────────────────────────────
  ["ss-3", "chemistry", "Organic Chemistry", "hard", "The IUPAC name of C₂H₅OH is ____.", ["ethanol", "ethanoic acid", "methanol", "ethane"], "Two carbons = ethanol (ethyl alcohol), the alcohol in drinks and sanitiser."],
  ["ss-3", "chemistry", "Organic Chemistry", "medium", "Ethanoic acid is the main acid found in ____.", ["vinegar", "kerosene", "soap", "honey"], "Vinegar is a dilute solution of ethanoic (acetic) acid."],
  ["ss-3", "chemistry", "Bonding & Reactions", "hard", "The molarity of a solution containing 0.5 mol of solute in 250 cm³ of solution is ____.", ["2 mol/dm³", "0.5 mol/dm³", "0.125 mol/dm³", "4 mol/dm³"], "M = mol ÷ volume(dm³) = 0.5 ÷ 0.25 = 2 mol/dm³."],
  ["ss-3", "chemistry", "Organic Chemistry", "medium", "The functional group of the alkanols (alcohols) is ____.", ["−OH", "−COOH", "−CHO", "−NH₂"], "Alkanols carry the hydroxyl group (−OH) attached to a saturated carbon."],
  ["ss-3", "chemistry", "Bonding & Reactions", "hard", "During electrolysis, reduction occurs at the ____.", ["cathode", "anode", "electrolyte", "salt bridge"], "Reduction (gain of electrons) happens at the negative electrode — the cathode."],
  ["ss-3", "chemistry", "Bonding & Reactions", "medium", "Hardness of water is caused mainly by dissolved ____ of calcium and magnesium.", ["salts", "gases", "acids", "oils"], "Calcium hydrogencarbonate and calcium sulfate make water hard and difficult to lather."],
  ["ss-3", "chemistry", "Bonding & Reactions", "hard", "The gas produced when zinc reacts with dilute hydrochloric acid is ____.", ["hydrogen", "oxygen", "carbon dioxide", "chlorine"], "Zn + 2HCl → ZnCl₂ + H₂. The pop test confirms hydrogen."],
  ["ss-3", "chemistry", "Organic Chemistry", "medium", "Alkanes have the general formula ____.", ["CₙH₂ₙ₊₂", "CₙH₂ₙ", "CₙH₂ₙ₋₂", "CₙHₙ"], "Methane CH₄, ethane C₂H₆ — each adds CH₂, giving CₙH₂ₙ₊₂."],

  // ── SS 3 · PHYSICS ──────────────────────────────────────────
  ["ss-3", "physics", "Motion & Force", "hard", "A stone thrown vertically upwards reaches its maximum height. At that moment its velocity is ____.", ["zero", "maximum", "constant", "negative"], "At the top, the stone momentarily stops before falling back — velocity is zero (acceleration is still g)."],
  ["ss-3", "physics", "Waves & Modern Physics", "medium", "A radioactive element has a half-life of 5 days. It decays to a quarter of its original amount after ____.", ["10 days", "5 days", "15 days", "20 days"], "Two half-lives are needed: ½ after 5 days, ¼ after 10 days."],
  ["ss-3", "physics", "Electricity", "hard", "In a step-down transformer, the secondary voltage is ____ the primary voltage.", ["less than", "greater than", "equal to", "double"], "Step-down transformers reduce voltage (and increase current) for safe domestic supply."],
  ["ss-3", "physics", "Energy & Work", "medium", "The SI unit of power is the ____.", ["watt", "joule", "newton", "volt"], "Power = energy ÷ time; 1 watt = 1 joule per second."],
  ["ss-3", "physics", "Waves & Modern Physics", "hard", "The bending and spreading of light as it passes through a narrow slit is called ____.", ["diffraction", "reflection", "refraction", "polarisation"], "Diffraction shows light behaves as a wave."],
  ["ss-3", "physics", "Electricity", "medium", "Electromagnetic induction is the production of electricity by ____.", ["relative motion between a coil and a magnet", "heating a coil of wire", "cooling a magnet", "using a battery"], "Faraday discovered that moving a magnet through a coil induces a current — how generators work."],
  ["ss-3", "physics", "Energy & Work", "hard", "A body of mass 5 kg moves at 4 m/s. Its kinetic energy is ____.", ["40 J", "20 J", "10 J", "80 J"], "KE = ½mv² = ½ × 5 × 4² = 40 J."],
  ["ss-3", "physics", "Waves & Modern Physics", "medium", "Nuclear fission is the splitting of a ____ nucleus into smaller parts.", ["heavy", "light", "stable", "neutral"], "Uranium-235 splits when hit by a neutron, releasing huge energy."],

  // ── SS 3 · BIOLOGY ──────────────────────────────────────────
  ["ss-3", "biology", "Living Processes", "medium", "The blood vessel that carries oxygenated blood from the lungs to the heart is the ____.", ["pulmonary vein", "pulmonary artery", "aorta", "vena cava"], "The pulmonary vein is the ONLY vein carrying oxygenated blood."],
  ["ss-3", "biology", "Genetics & Variation", "hard", "The genotype ratio from a cross between two heterozygous (Tt) parents is ____.", ["1 TT : 2 Tt : 1 tt", "3 TT : 1 tt", "all Tt", "2 TT : 2 tt"], "Tt × Tt → TT, Tt, Tt, tt — a 1:2:1 genotype ratio (3:1 phenotype)."],
  ["ss-3", "biology", "Living Processes", "medium", "Gaseous exchange in mammals takes place in the ____.", ["alveoli", "bronchi", "trachea", "diaphragm"], "Alveoli are thin-walled air sacs wrapped in capillaries — the exchange surface."],
  ["ss-3", "biology", "Ecology", "hard", "Eutrophication of lakes and rivers is caused mainly by excess ____ in the water.", ["nutrients", "salt", "oxygen", "sand"], "Fertiliser runoff feeds algal blooms; their decay robs the water of oxygen."],
  ["ss-3", "biology", "Living Processes", "medium", "The end products of anaerobic respiration in yeast are ethanol and ____.", ["carbon dioxide", "oxygen", "water", "lactic acid"], "Yeast fermentation: glucose → ethanol + CO₂ (+ a little energy). Lactic acid is made in human muscles."],
  ["ss-3", "biology", "Living Processes", "medium", "Which organ removes urea from the blood?", ["Kidney", "Liver", "Lungs", "Skin"], "Kidneys filter urea from blood to make urine. The liver produces urea but the kidneys excrete it."],
  ["ss-3", "biology", "Genetics & Variation", "hard", "The symbiotic bacteria in legume root nodules fix ____ from the air for the plant.", ["nitrogen", "oxygen", "carbon", "hydrogen"], "Rhizobium bacteria convert atmospheric nitrogen into nitrates the plant can use."],
  ["ss-3", "biology", "Living Processes", "medium", "The growth response of a plant shoot towards light is called ____.", ["phototropism", "geotropism", "hydrotropism", "thigmotropism"], "Photo = light. Shoots show positive phototropism — they grow towards light."],

  // ── SS 3 · MATHEMATICS ──────────────────────────────────────
  ["ss-3", "mathematics", "Number & Operations", "hard", "Solve for x: log₃ 81 = x.", ["4", "3", "27", "9"], "3⁴ = 81, so x = 4."],
  ["ss-3", "mathematics", "Algebra", "medium", "Find the derivative of y = 3x³.", ["9x²", "3x²", "9x", "x³"], "dy/dx = 3 × 3x² = 9x²."],
  ["ss-3", "mathematics", "Algebra", "hard", "The integral of 5x⁴ dx is ____.", ["x⁵ + C", "5x⁵ + C", "20x³ + C", "4x⁵ + C"], "Raise the power and divide by it: 5x⁵⁄5 = x⁵, plus the constant of integration."],
  ["ss-3", "mathematics", "Statistics & Probability", "medium", "The probability of an impossible event is ____.", ["0", "1", "0.5", "2"], "An impossible event can never happen, so its probability is 0."],
  ["ss-3", "mathematics", "Statistics & Probability", "hard", "In how many different ways can 5 students be arranged in a row?", ["120", "25", "60", "24"], "This is 5! = 5 × 4 × 3 × 2 × 1 = 120 permutations."],
  ["ss-3", "mathematics", "Statistics & Probability", "medium", "If P(A) = 0.3, P(B) = 0.4 and A and B are independent, P(A ∩ B) = ____.", ["0.12", "0.7", "0.1", "0.58"], "For independent events, multiply: 0.3 × 0.4 = 0.12."],
  ["ss-3", "mathematics", "Geometry & Measurement", "hard", "A circle has area 154 cm². Using π = 22/7, its radius is ____.", ["7 cm", "14 cm", "49 cm", "3.5 cm"], "πr² = 154 → r² = 154 × 7/22 = 49, so r = 7 cm."],
  ["ss-3", "mathematics", "Geometry & Measurement", "medium", "Convert 72° to radians.", ["2π/5", "π/5", "3π/5", "π/2"], "Multiply by π/180: 72 × π/180 = 2π/5 radians."],

  // ── SS 3 · ENGLISH ──────────────────────────────────────────
  ["ss-3", "english-language", "Vocabulary", "hard", "'The council has ratified the decision.' The word 'ratified' means ____.", ["officially approved", "rejected", "postponed", "reviewed"], "To ratify is to give formal approval — like ratifying a treaty."],
  ["ss-3", "english-language", "Vocabulary", "medium", "Choose the word nearest in meaning: 'The professor's argument was cogent.'", ["convincing", "weak", "lengthy", "amusing"], "A cogent argument is clear, logical and convincing."],
  ["ss-3", "english-language", "Grammar", "hard", "Had he known earlier, he ____ have travelled that night.", ["would", "will", "shall", "must"], "This is a third-conditional (unreal past) structure: would + have + past participle."],
  ["ss-3", "english-language", "Vocabulary", "medium", "An epitaph is an inscription written on a ____.", ["tomb", "throne", "trophy", "temple"], "An epitaph honours a dead person — it is carved on a tomb or gravestone."],
  ["ss-3", "english-language", "Comprehension & Usage", "hard", "No sooner had the rain started ____ the power went off.", ["than", "when", "that", "then"], "'No sooner … than' is the fixed correlative pair."],
  ["ss-3", "english-language", "Vocabulary", "medium", "Choose the word opposite in meaning to 'scarce'.", ["abundant", "rare", "little", "few"], "Scarce = in short supply; abundant = plentiful."],

  // ── SS 3 · ECONOMICS ────────────────────────────────────────
  ["ss-3", "economics", "Basic Concepts", "easy", "Economics is the study of how society manages its ____ resources.", ["scarce", "unlimited", "useless", "free"], "Resources are limited but wants are unlimited — that's the basic economic problem."],
  ["ss-3", "economics", "Demand & Supply", "medium", "The demand curve normally slopes ____ from left to right.", ["downward", "upward", "vertically", "horizontally"], "People buy more at lower prices and less at higher prices — the law of demand."],
  ["ss-3", "economics", "Demand & Supply", "medium", "When the price of a good rises (other things equal), the quantity demanded ____.", ["falls", "rises", "stays the same", "doubles"], "Price and quantity demanded move in opposite directions."],
  ["ss-3", "economics", "Money & Banking", "hard", "The institution responsible for controlling the money supply in Nigeria is the ____.", ["Central Bank of Nigeria", "Ministry of Finance", "commercial banks", "Nigerian Stock Exchange"], "The CBN issues currency, sets monetary policy and supervises banks."],
  ["ss-3", "economics", "Basic Concepts", "medium", "Opportunity cost is the ____ alternative forgone when a choice is made.", ["next best", "worst", "cheapest", "most expensive"], "Every choice costs you the value of the best option you gave up."],
  ["ss-3", "economics", "Money & Banking", "hard", "Inflation is a persistent ____ in the general price level of goods and services.", ["rise", "fall", "stability", "shortage"], "When prices rise persistently, each naira buys less — money loses value."],
  ["ss-3", "economics", "Demand & Supply", "medium", "A market with only ONE seller of a product is called a ____.", ["monopoly", "oligopoly", "perfect competition", "duopoly"], "Mono = one. The single seller controls price — like a public utility."],
  ["ss-3", "economics", "Money & Banking", "medium", "GDP stands for Gross ____ Product.", ["Domestic", "Development", "Demand", "Deposit"], "GDP — the total value of goods and services produced WITHIN a country in a year."],
];
