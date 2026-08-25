import { getGradeExperience, normalizeGradeLevel } from "../data/gradeExperience";

export const CAMERA_CARD_COLORS = [
  { id: "blue", label: "Blue", rgb: [36, 99, 235], hex: "#2463eb" },
  { id: "green", label: "Green", rgb: [22, 163, 74], hex: "#16a34a" },
  { id: "orange", label: "Orange", rgb: [234, 88, 12], hex: "#ea580c" },
  { id: "violet", label: "Violet", rgb: [124, 58, 237], hex: "#7c3aed" },
];

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getLearningWeek(value = new Date()) {
  const current = value instanceof Date ? new Date(value) : new Date(value);
  const safeDate = Number.isNaN(current.getTime()) ? new Date() : current;
  safeDate.setHours(12, 0, 0, 0);
  const mondayOffset = (safeDate.getDay() + 6) % 7;
  const startsAtDate = new Date(safeDate);
  startsAtDate.setDate(startsAtDate.getDate() - mondayOffset);
  startsAtDate.setHours(0, 0, 0, 0);
  const endsAtDate = new Date(startsAtDate);
  endsAtDate.setDate(endsAtDate.getDate() + 6);
  endsAtDate.setHours(23, 59, 59, 999);
  const monthDay = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
  const endLabel = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return {
    key: dateKey(startsAtDate),
    label: `${monthDay.format(startsAtDate)}–${endLabel.format(endsAtDate)}`,
    startsAt: startsAtDate.getTime(),
    endsAt: endsAtDate.getTime(),
  };
}

function weeklySeed(weekKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(weekKey || ""));
  if (!match) return 0;
  const mondayUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.floor(mondayUtc / (7 * 24 * 60 * 60 * 1000));
}

function shuffle(input, seed = Date.now()) {
  const result = [...input];
  let state = Math.abs(Number(seed) || 1) % 2147483647;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 48271) % 2147483647;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniqueChoices(answer, candidates, count = 4) {
  const values = [answer, ...candidates]
    .map((value) => String(value))
    .filter((value, index, array) => array.indexOf(value) === index);
  let filler = Number(answer);
  while (values.length < count) {
    filler += 1;
    if (!values.includes(String(filler))) values.push(String(filler));
  }
  return shuffle(values.slice(0, count), Number(answer) * 17 + values.length);
}

function mathQuestion(grade, index, requestedLevel = 1, missionSeed = 0) {
  const gradeNumber = Number(normalizeGradeLevel(grade).replace(/\D/g, "")) || 3;
  const level = Math.max(1, Math.min(10, Number(requestedLevel) || 1));
  const seed = index + level * 17 + gradeNumber * 31 + missionSeed * 97;

  if (gradeNumber === 3) {
    if (level <= 2) {
      const a = 4 + (seed % (16 + level * 8));
      const b = 3 + ((seed * 3) % (11 + level * 5));
      const answer = a + b;
      return { prompt: `${a} + ${b} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - 2, answer + 2, answer + 5]), explanation: `${a} plus ${b} equals ${answer}.`, skill: `Level ${level} addition` };
    }
    if (level <= 4) {
      const a = 28 + (seed % (28 + level * 8));
      const b = 5 + ((seed * 2) % Math.max(8, a - 8));
      const answer = a - b;
      return { prompt: `${a} − ${b} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - 3, answer + 3, answer + b]), explanation: `${a} minus ${b} equals ${answer}.`, skill: `Level ${level} subtraction` };
    }
    if (level <= 7) {
      const a = 2 + (seed % Math.min(10, level + 2));
      const b = 2 + ((seed * 3) % Math.min(10, level + 2));
      const answer = a * b;
      return { prompt: `${a} × ${b} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - a, answer + a, a + b]), explanation: `${a} groups of ${b} make ${answer}.`, skill: `Level ${level} multiplication` };
    }
    const groups = 2 + (seed % 8);
    const each = 2 + ((seed * 3) % 9);
    const extra = level === 10 ? 3 + (seed % 7) : 0;
    const answer = groups * each + extra;
    return {
      prompt: level === 10 ? `${groups} bags have ${each} marbles each, plus ${extra} extra. How many marbles?` : `${groups} groups of ${each} objects make how many?`,
      answer: String(answer),
      choices: uniqueChoices(answer, [answer - each, answer + each, groups + each + extra]),
      explanation: `Multiply ${groups} by ${each}${extra ? `, then add ${extra}` : ""}. The answer is ${answer}.`,
      skill: `Level ${level} problem solving`,
    };
  }

  if (gradeNumber === 4) {
    if (level <= 3) {
      const a = 120 + ((seed * 13) % (280 + level * 80));
      const b = 35 + ((seed * 7) % 180);
      const subtract = seed % 2 === 0;
      const high = subtract ? Math.max(a, b) : a;
      const low = subtract ? Math.min(a, b) : b;
      const answer = subtract ? high - low : high + low;
      return { prompt: `${high} ${subtract ? "−" : "+"} ${low} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - 10, answer + 10, answer + 100]), explanation: `Work carefully by place value. The answer is ${answer}.`, skill: `Level ${level} multi-digit operations` };
    }
    if (level <= 6) {
      const a = 3 + (seed % (6 + level));
      const b = 4 + ((seed * 3) % 12);
      const answer = a * b;
      return { prompt: `${a} × ${b} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - a, answer + b, a + b]), explanation: `${a} multiplied by ${b} is ${answer}.`, skill: `Level ${level} multiplication` };
    }
    if (level <= 8) {
      const divisor = 3 + (seed % 9);
      const answer = 4 + ((seed * 2) % 12);
      const dividend = divisor * answer;
      return { prompt: `${dividend} ÷ ${divisor} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - 2, answer + 2, divisor]), explanation: `${divisor} fits into ${dividend} exactly ${answer} times.`, skill: `Level ${level} division` };
    }
    const packs = 3 + (seed % 8);
    const each = 12 + ((seed * 3) % 19);
    const used = 5 + (seed % 12);
    const answer = packs * each - used;
    return { prompt: `${packs} packs contain ${each} cards each. ${used} cards are used. How many remain?`, answer: String(answer), choices: uniqueChoices(answer, [answer + used, packs * each, answer - packs]), explanation: `Multiply first, then subtract: ${packs} × ${each} − ${used} = ${answer}.`, skill: `Level ${level} multi-step problems` };
  }

  if (gradeNumber === 5) {
    if (level <= 3) {
      const a = (15 + (seed % 55)) / 10;
      const b = (4 + ((seed * 3) % 30)) / 10;
      const subtract = level === 3 && a > b;
      const answer = (subtract ? a - b : a + b).toFixed(1);
      return { prompt: `${a.toFixed(1)} ${subtract ? "−" : "+"} ${b.toFixed(1)} = ?`, answer, choices: uniqueChoices(answer, [(Number(answer) - .5).toFixed(1), (Number(answer) + .5).toFixed(1), (Number(answer) + 1).toFixed(1)]), explanation: `Align the decimal points. The answer is ${answer}.`, skill: `Level ${level} decimals` };
    }
    if (level <= 6) {
      const denominator = [4, 5, 6, 8, 10][seed % 5];
      const numeratorA = 1 + (seed % (denominator - 1));
      const numeratorB = 1 + ((seed * 2) % (denominator - 1));
      const answer = `${numeratorA + numeratorB}/${denominator}`;
      return { prompt: `${numeratorA}/${denominator} + ${numeratorB}/${denominator} = ?`, answer, choices: shuffle([answer, `${numeratorA + numeratorB}/${denominator * 2}`, `${Math.abs(numeratorA - numeratorB)}/${denominator}`, `${numeratorA + numeratorB + 1}/${denominator}`], seed), explanation: `Keep the denominator and add the numerators. The answer is ${answer}.`, skill: `Level ${level} fractions` };
    }
    if (level <= 8) {
      const factor = 12 + (seed % 35);
      const multiplier = 3 + ((seed * 2) % 9);
      const answer = factor * multiplier;
      return { prompt: `${factor} × ${multiplier} = ?`, answer: String(answer), choices: uniqueChoices(answer, [answer - factor, answer + factor, factor + multiplier]), explanation: `${factor} multiplied by ${multiplier} is ${answer}.`, skill: `Level ${level} computation` };
    }
    const price = 18 + (seed % 18) * 2;
    const count = 2 + (seed % 6);
    const paid = Math.ceil((price * count) / 100) * 100;
    const answer = paid - price * count;
    return { prompt: `${count} items cost ₱${price} each. You pay ₱${paid}. What is the change?`, answer: String(answer), choices: uniqueChoices(answer, [answer + price, Math.max(0, answer - 10), price * count]), explanation: `Total cost is ₱${price * count}; the change is ₱${answer}.`, skill: `Level ${level} money problems` };
  }

  if (level <= 3) {
    const a = (25 + (seed % 70)) / 10;
    const b = (8 + ((seed * 3) % 40)) / 10;
    const answer = (a + b).toFixed(1);
    return { prompt: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`, answer, choices: uniqueChoices(answer, [(Number(answer) - 1).toFixed(1), (Number(answer) + 1).toFixed(1), (a + b + .5).toFixed(1)]), explanation: `The decimal sum is ${answer}.`, skill: `Level ${level} decimal reasoning` };
  }
  if (level <= 6) {
    const base = [40, 60, 80, 100, 120, 160][seed % 6];
    const percent = [10, 20, 25, 50, 75][seed % 5];
    const answer = (base * percent) / 100;
    return { prompt: `What is ${percent}% of ${base}?`, answer: String(answer), choices: uniqueChoices(answer, [answer + 5, answer * 2, Math.max(0, base - answer)]), explanation: `${percent}% of ${base} is ${answer}.`, skill: `Level ${level} percent` };
  }
  if (level <= 8) {
    const first = 2 + (seed % 7);
    const second = 3 + ((seed * 2) % 8);
    const multiplier = 2 + (seed % 5);
    const answer = second * multiplier;
    return { prompt: `Complete the equivalent ratio: ${first}:${second} = ${first * multiplier}:?`, answer: String(answer), choices: uniqueChoices(answer, [answer - second, answer + second, first * multiplier]), explanation: `Multiply both parts by ${multiplier}. The missing number is ${answer}.`, skill: `Level ${level} ratios` };
  }
  const price = 45 + (seed % 16) * 5;
  const count = 2 + (seed % 6);
  const discount = level === 10 ? 20 : 10;
  const subtotal = price * count;
  const answer = subtotal - (subtotal * discount) / 100;
  return { prompt: `${count} items cost ₱${price} each with a ${discount}% discount. What is the final cost?`, answer: String(answer), choices: uniqueChoices(answer, [subtotal, answer + price, Math.max(0, answer - price)]), explanation: `The subtotal is ₱${subtotal}; after ${discount}% off, the final cost is ₱${answer}.`, skill: `Level ${level} multi-step percent` };
}

const LANGUAGE_BANK = {
  3: [
    ["Which word is a noun?", "garden", ["quickly", "garden", "bright", "under"], "A noun names a person, place, animal, or thing."],
    ["Choose the correct sentence.", "The dogs are playing.", ["The dogs is playing.", "The dogs are playing.", "The dogs am playing.", "The dogs be playing."], "A plural subject uses ‘are’."],
    ["Which word means the same as happy?", "glad", ["sad", "glad", "slow", "dark"], "Glad is a synonym of happy."],
  ],
  4: [
    ["The trail was steep, so Ana climbed slowly. What does steep mean?", "rising sharply", ["perfectly flat", "rising sharply", "very short", "full of water"], "The context shows the trail was difficult to climb."],
    ["Which sentence has a complete thought?", "The class planted vegetables.", ["Because it was raining.", "Under the tall tree.", "The class planted vegetables.", "After the program."], "A complete sentence has a subject and a predicate."],
    ["Which transition shows sequence?", "Next", ["However", "Next", "Because", "Although"], "Next tells what happens after an earlier step."],
  ],
  5: [
    ["The glass was fragile, so Mia carried it carefully. Fragile means…", "easy to break", ["very heavy", "easy to break", "brightly colored", "expensive"], "The action ‘carried it carefully’ gives the clue."],
    ["Which statement is supported by evidence?", "Plants near the window grew taller in the recorded data.", ["All plants love music.", "Plants near the window grew taller in the recorded data.", "Green is the best color.", "The experiment was fun."], "Evidence is based on observations or data."],
    ["Which is the best summary?", "A short statement of the text’s main ideas", ["Every sentence copied", "A personal opinion only", "A short statement of the text’s main ideas", "The title repeated"], "A summary includes the most important ideas briefly."],
  ],
  6: [
    ["Which source is most reliable for a science report?", "A peer-reviewed science journal", ["An anonymous comment", "A peer-reviewed science journal", "An advertisement", "An unverified post"], "Reliable sources identify evidence, authors, and review standards."],
    ["What is the author’s claim?", "The main position the author argues", ["A decorative image", "The main position the author argues", "Every supporting detail", "The publication date"], "A claim is the central position supported by reasons and evidence."],
    ["Which sentence uses a formal tone?", "The results indicate a significant improvement.", ["The results were super awesome!", "Wow, that worked!", "The results indicate a significant improvement.", "It was kinda better."], "Formal writing uses precise, objective language."],
  ],
};

const ENGLISH_CAMERA_READING_BANK = {
  3: [
    ["The yellow bird sings in the tree.", "Read every word clearly and pause at the period.", "Fluency"],
    ["Mina packs her books before school.", "Keep the words in the same order.", "Accuracy"],
    ["Our class plants seeds in the garden.", "Use a steady voice from the first word to the last.", "Phrasing"],
    ["The small puppy runs after the red ball.", "Notice the describing words small and red.", "Expression"],
    ["We share our crayons with our friends.", "Read share and friends carefully.", "Vocabulary"],
    ["Rain falls softly on the green leaves.", "Read softly to show how the rain falls.", "Expression"],
    ["Lito drinks water after playing outside.", "Take one calm breath before reading.", "Fluency"],
    ["The children listen to a funny story.", "Keep a smooth pace through the whole sentence.", "Phrasing"],
    ["Mother cooks warm soup for our family.", "Read the sentence gently and clearly.", "Expression"],
    ["We keep our classroom clean and safe.", "Say each word in the correct order.", "Accuracy"],
  ],
  4: [
    ["The curious explorer followed the narrow forest trail.", "Group the words into a smooth phrase.", "Fluency"],
    ["During the experiment, the water slowly changed color.", "Pause briefly after the comma.", "Punctuation"],
    ["A healthy breakfast gives us energy for the day.", "Stress the important words healthy and energy.", "Expression"],
    ["The community worked together to clean the riverbank.", "Read the longer word community one syllable at a time.", "Accuracy"],
    ["Bees carry pollen as they travel from flower to flower.", "Keep a steady pace and pronounce pollen clearly.", "Science vocabulary"],
    ["Carlo checked the map before choosing the safest path.", "Read the sentence as one complete idea.", "Comprehension"],
    ["The audience clapped when the young dancers finished.", "Let your voice show the excitement in the sentence.", "Expression"],
    ["We can protect nature by reducing plastic waste.", "Give extra attention to reducing and plastic.", "Vocabulary"],
    ["After the rain stopped, a bright rainbow appeared.", "Pause briefly after the opening phrase.", "Punctuation"],
    ["The librarian helped Mara find a book about planets.", "Read librarian and planets carefully.", "Vocabulary"],
  ],
  5: [
    ["Although the sky was cloudy, the team continued its field study.", "Use the comma to separate the opening idea.", "Phrasing"],
    ["The scientist recorded each observation before drawing a conclusion.", "Read observation and conclusion clearly.", "Academic vocabulary"],
    ["Responsible citizens conserve water and protect natural resources.", "Keep an even pace through the longer words.", "Fluency"],
    ["Because the bridge was damaged, travelers used a safer route.", "Pause after damaged, then finish the result.", "Cause and effect"],
    ["The author included strong evidence to support the main idea.", "Stress evidence and main idea.", "Reading vocabulary"],
    ["Regular exercise strengthens the heart, muscles, and lungs.", "Use short pauses for the items in the list.", "Punctuation"],
    ["Maria compared the two solutions before making her decision.", "Read compared and decision accurately.", "Accuracy"],
    ["Protecting local habitats helps many species survive and grow.", "Read the complete thought smoothly.", "Fluency"],
    ["The volunteers organized supplies for families affected by the storm.", "Group related words into smooth phrases.", "Phrasing"],
    ["Careful readers connect important details to understand the central message.", "Stress important details and central message.", "Comprehension"],
  ],
  6: [
    ["Reliable evidence allows researchers to evaluate a claim objectively.", "Emphasize reliable evidence and objectively.", "Academic fluency"],
    ["When communities prepare early, they respond more effectively to disasters.", "Pause at the comma and keep a formal tone.", "Phrasing"],
    ["The data indicate that conservation efforts improved the coastal habitat.", "Read indicate, conservation, and habitat clearly.", "Science vocabulary"],
    ["Digital information should be verified before it is shared with others.", "Use a steady, confident pace.", "Media literacy"],
    ["Even though the proposal had limitations, it offered a practical solution.", "Let the comma mark the change between ideas.", "Complex sentences"],
    ["The writer develops an argument by connecting reasons with credible evidence.", "Stress argument, reasons, and credible evidence.", "Argumentation"],
    ["Renewable energy can reduce pollution while supporting sustainable development.", "Carefully pronounce renewable and sustainable.", "Academic vocabulary"],
    ["Careful analysis helps readers distinguish facts from unsupported opinions.", "Finish the sentence with a clear falling tone.", "Critical reading"],
    ["Effective communication requires accurate information, respectful language, and active listening.", "Use brief pauses between the three ideas.", "Formal fluency"],
    ["By examining multiple sources, students can form a balanced and evidence-based conclusion.", "Pause after sources and emphasize evidence-based conclusion.", "Critical literacy"],
  ],
};

const FILIPINO_CAMERA_READING_BANK = {
  3: [
    ["Masayang naglalaro ang mga bata sa parke.", "Basahin nang malinaw ang bawat salita.", "Kahusayan sa pagbasa"],
    ["Si Ana ay maagang pumasok sa paaralan.", "Panatilihin ang tamang ayos ng mga salita.", "Katumpakan"],
    ["Makulay ang mga bulaklak sa aming hardin.", "Bigyang-diin ang salitang makulay.", "Pagpapahayag"],
    ["Tumutulong ako sa paglilinis ng aming bahay.", "Basahin nang banayad at tuloy-tuloy.", "Kahusayan sa pagbasa"],
    ["Ang maliit na ibon ay lumipad sa puno.", "Bigkasin nang malinaw ang maliit at lumipad.", "Talasalitaan"],
    ["Masarap ang hinog na mangga sa hapag.", "Gamitin ang masayang tono sa pagbasa.", "Pagpapahayag"],
    ["Nagbabasa kami ng kuwento bago matulog.", "Huminga muna bago basahin ang pangungusap.", "Wastong bilis"],
    ["Inaalagaan ni Lito ang kanyang alagang aso.", "Bigkasin nang maayos ang inaalagaan.", "Katumpakan"],
    ["Nagtatanim si Lola ng gulay sa bakuran.", "Basahin ang buong diwa nang tuloy-tuloy.", "Pag-unawa"],
    ["Ibinabahagi namin ang laruan sa aming kaibigan.", "Bigyang-pansin ang salitang ibinabahagi.", "Talasalitaan"],
  ],
  4: [
    ["Maingat na tumawid ang mga mag-aaral sa tamang tawiran.", "Bigkasin nang malinaw ang maingat at tawiran.", "Katumpakan"],
    ["Pagkatapos ng ulan, lumitaw ang makulay na bahaghari.", "Huminto nang bahagya pagkatapos ng kuwit.", "Bantas"],
    ["Nagtulungan ang magkakapitbahay sa paglilinis ng paligid.", "Pangkatin ang mga salita sa maayos na parirala.", "Kahusayan sa pagbasa"],
    ["Ang masustansiyang pagkain ay nagbibigay ng lakas sa katawan.", "Bigyang-diin ang masustansiyang at lakas.", "Talasalitaan"],
    ["Dinala ni Carlo ang payong dahil makulimlim ang langit.", "Basahin bilang isang buong kaisipan.", "Sanhi at bunga"],
    ["Maagang naghanda ang pamilya para sa paparating na bagyo.", "Panatilihin ang mahinahong bilis.", "Kahusayan sa pagbasa"],
    ["Ang mga bubuyog ay nagdadala ng polen sa mga bulaklak.", "Bigkasin nang malinaw ang bubuyog at polen.", "Agham na talasalitaan"],
    ["Nagpalakpakan ang mga manonood matapos ang pagtatanghal.", "Ipakita sa boses ang saya ng pangyayari.", "Pagpapahayag"],
    ["Pinoprotektahan natin ang kalikasan sa wastong pagtatapon ng basura.", "Basahin nang malinaw ang pinoprotektahan.", "Talasalitaan"],
    ["Tinulungan ng librarian si Mara na humanap ng aklat.", "Panatilihin ang wastong pagkakasunod ng mga salita.", "Katumpakan"],
  ],
  5: [
    ["Bagaman makulimlim ang langit, ipinagpatuloy ng pangkat ang pag-aaral.", "Gamitin ang kuwit upang paghiwalayin ang dalawang ideya.", "Parirala"],
    ["Itinala ng siyentipiko ang bawat obserbasyon bago bumuo ng konklusyon.", "Bigkasin nang malinaw ang obserbasyon at konklusyon.", "Akademikong talasalitaan"],
    ["Ang responsableng mamamayan ay nagtitipid ng tubig at kuryente.", "Basahin nang pantay ang bilis.", "Kahusayan sa pagbasa"],
    ["Dahil nasira ang tulay, gumamit ang mga manlalakbay ng ligtas na daan.", "Huminto pagkatapos ng tulay bago basahin ang bunga.", "Sanhi at bunga"],
    ["Gumamit ang may-akda ng matibay na ebidensya upang suportahan ang ideya.", "Bigyang-diin ang ebidensya at ideya.", "Pag-unawa"],
    ["Ang regular na ehersisyo ay nagpapalakas sa puso, kalamnan, at baga.", "Gumamit ng maikling paghinto sa bawat bahagi ng talaan.", "Bantas"],
    ["Inihambing ni Maria ang dalawang solusyon bago magpasya.", "Bigkasin nang tama ang inihambing at solusyon.", "Katumpakan"],
    ["Ang pangangalaga sa tirahan ng hayop ay tumutulong sa kanilang kaligtasan.", "Basahin ang buong kaisipan nang maayos.", "Kahusayan sa pagbasa"],
    ["Inayos ng mga boluntaryo ang tulong para sa mga pamilyang nasalanta.", "Pangkatin ang magkakaugnay na salita.", "Parirala"],
    ["Iniuugnay ng mahusay na mambabasa ang detalye sa pangunahing mensahe.", "Bigyang-diin ang detalye at pangunahing mensahe.", "Pag-unawa"],
  ],
  6: [
    ["Ang mapananaligang ebidensya ay tumutulong sa pagsusuri ng isang pahayag.", "Bigyang-diin ang mapananaligang ebidensya.", "Akademikong pagbasa"],
    ["Kapag maagang naghahanda ang pamayanan, mas mahusay itong tumutugon sa sakuna.", "Huminto sa kuwit at panatilihin ang pormal na tono.", "Parirala"],
    ["Ipinakikita ng datos na napabuti ng pangangalaga ang baybaying tirahan.", "Bigkasin nang malinaw ang datos at pangangalaga.", "Agham na talasalitaan"],
    ["Dapat beripikahin ang impormasyong digital bago ito ibahagi sa iba.", "Basahin nang matatag at may tiwala.", "Kaalamang pangmidya"],
    ["Bagaman may limitasyon ang mungkahi, nagbigay ito ng praktikal na solusyon.", "Gamitin ang kuwit sa pagbabago ng ideya.", "Masalimuot na pangungusap"],
    ["Binubuo ng manunulat ang argumento sa pamamagitan ng dahilan at ebidensya.", "Bigyang-diin ang argumento, dahilan, at ebidensya.", "Argumentasyon"],
    ["Nababawasan ng nababagong enerhiya ang polusyon at napapanatili ang kaunlaran.", "Bigkasin nang maingat ang nababagong at napapanatili.", "Akademikong talasalitaan"],
    ["Tinutulungan ng masusing pagsusuri ang mambabasa na makilala ang katotohanan.", "Tapusin ang pangungusap sa malinaw na tono.", "Kritikal na pagbasa"],
    ["Nangangailangan ang mabisang komunikasyon ng wasto at magalang na pananalita.", "Panatilihin ang pormal at mahinahong tinig.", "Pormal na pagbasa"],
    ["Sa pagsusuri ng maraming sanggunian, makabubuo ang mag-aaral ng balanseng konklusyon.", "Huminto sa kuwit at bigyang-diin ang balanseng konklusyon.", "Kritikal na literasiya"],
  ],
};

function readingThreshold(grade, level, language) {
  const gradeNumber = Number(normalizeGradeLevel(grade).replace(/\D/g, "")) || 3;
  const languageAdjustment = language === "filipino" ? -3 : 0;
  return Math.min(84, 59 + (gradeNumber - 3) * 3 + Math.floor((level - 1) * 1.5) + languageAdjustment);
}

export function buildReadingCameraQuestions(grade, requestedLevel = 1, count = 10, language = "english") {
  const gradeNumber = Number(normalizeGradeLevel(grade).replace(/\D/g, "")) || 3;
  const level = Math.max(1, Math.min(10, Number(requestedLevel) || 1));
  const normalizedLanguage = language === "filipino" ? "filipino" : "english";
  const bank = normalizedLanguage === "filipino" ? FILIPINO_CAMERA_READING_BANK : ENGLISH_CAMERA_READING_BANK;
  const rows = bank[gradeNumber] || bank[3];
  const offset = ((level - 1) * 3) % rows.length;
  return Array.from({ length: count }, (_, index) => {
    const [readingText, coachingTip, skill] = rows[(index + offset) % rows.length];
    return {
      id: `${normalizedLanguage}-reading-${gradeNumber}-level-${level}-${index}`,
      prompt: normalizedLanguage === "filipino" ? "Basahin ito nang malakas" : "Read this aloud",
      readingText,
      answer: readingText,
      choices: [],
      explanation: coachingTip,
      skill,
      language: normalizedLanguage,
      level,
      passAccuracy: readingThreshold(grade, level, normalizedLanguage),
    };
  });
}

function spokenWords(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function wordEditDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function scoreReadingTranscript(target, transcript) {
  const targetWords = spokenWords(target);
  const spoken = spokenWords(transcript);
  if (!targetWords.length || !spoken.length) {
    return { accuracy: 0, matchedWords: 0, totalWords: targetWords.length, missingWords: targetWords.slice(0, 4) };
  }

  const distance = wordEditDistance(targetWords, spoken);
  const sequenceAccuracy = Math.max(0, 1 - distance / Math.max(targetWords.length, spoken.length));
  const available = [...spoken];
  const matchedWords = targetWords.reduce((count, word) => {
    const index = available.indexOf(word);
    if (index < 0) return count;
    available.splice(index, 1);
    return count + 1;
  }, 0);
  const coverage = matchedWords / targetWords.length;
  const accuracy = Math.round((sequenceAccuracy * 0.65 + coverage * 0.35) * 100);
  const spokenSet = new Set(spoken);
  const missingWords = [...new Set(targetWords.filter((word) => !spokenSet.has(word)))].slice(0, 4);
  return { accuracy, matchedWords, totalWords: targetWords.length, missingWords };
}

const SCIENCE_BANK = {
  3: [
    ["Which object is a solid?", "A wooden block", ["Water", "Air", "A wooden block", "Steam"], "A solid has a definite shape."],
    ["What do plants need to make food?", "Sunlight", ["Plastic", "Sunlight", "Metal", "Sand only"], "Plants use sunlight during photosynthesis."],
    ["Which sense organ helps us hear?", "Ears", ["Eyes", "Nose", "Ears", "Skin"], "The ears receive sound vibrations."],
  ],
  4: [
    ["Which stage comes after a butterfly larva?", "Pupa", ["Egg", "Pupa", "Adult", "Seed"], "The butterfly life cycle is egg, larva, pupa, adult."],
    ["What happens when water freezes?", "It becomes a solid", ["It becomes a gas", "It becomes a solid", "It disappears", "It becomes light"], "Freezing changes liquid water into solid ice."],
    ["Which is a conductor of electricity?", "Copper wire", ["Rubber band", "Wooden ruler", "Copper wire", "Plastic cup"], "Metals such as copper conduct electricity."],
  ],
  5: [
    ["Which organ pumps blood through the body?", "Heart", ["Lungs", "Heart", "Stomach", "Kidneys"], "The heart pushes blood through blood vessels."],
    ["Why do shadows change length during the day?", "The apparent position of the Sun changes", ["Objects shrink", "The Sun changes size", "The apparent position of the Sun changes", "Air becomes heavier"], "Earth’s rotation changes the Sun’s apparent angle."],
    ["Which variable should be changed in a fair test?", "Only the independent variable", ["All variables", "Only the independent variable", "No variables", "The recorded result"], "A fair test changes one factor while controlling the others."],
  ],
  6: [
    ["What causes day and night?", "Earth’s rotation", ["Earth’s revolution", "Earth’s rotation", "The Moon’s phases", "Cloud movement"], "Earth rotates on its axis about once every 24 hours."],
    ["Which evidence best supports a conclusion?", "Repeated measurements with consistent results", ["One guess", "A popular opinion", "Repeated measurements with consistent results", "A colorful chart without data"], "Repeated observations make a conclusion more reliable."],
    ["In a food web, what is a producer?", "An organism that makes its own food", ["An animal that hunts", "An organism that makes its own food", "A decomposer only", "Any large organism"], "Plants and algae use energy to make food."],
  ],
};

const FILIPINO_BANK = {
  3: [
    ["Alin ang pangngalan?", "paaralan", ["mabilis", "paaralan", "masaya", "tumakbo"], "Ang pangngalan ay ngalan ng tao, bagay, hayop, lugar, o pangyayari."],
    ["Ano ang kasalungat ng ‘mataas’?", "mababa", ["malaki", "mababa", "mahaba", "mabilis"], "Ang mababa ay kasalungat ng mataas."],
  ],
  4: [
    ["Alin ang pang-uri sa pangungusap: ‘Makulay ang saranggola.’", "Makulay", ["ang", "Makulay", "saranggola", "wala"], "Ang pang-uri ay naglalarawan sa pangngalan."],
    ["Alin ang wastong ayos ng pangyayari?", "Una, sumunod, pagkatapos, wakas", ["Wakas, una, sumunod", "Una, sumunod, pagkatapos, wakas", "Pagkatapos, una, wakas", "Sumunod, wakas, una"], "Ginagamit ang mga panandang ito sa wastong pagkakasunod-sunod."],
  ],
  5: [
    ["Ano ang pangunahing ideya?", "Pinakamahalagang mensahe ng talata", ["Isang maliit na detalye", "Pinakamahalagang mensahe ng talata", "Pangalan ng may-akda", "Huling salita"], "Ang pangunahing ideya ang sentrong mensahe ng teksto."],
    ["Alin ang nagpapakita ng sanhi at bunga?", "Umulan kaya bumaha.", ["Maganda ang bulaklak.", "Umulan kaya bumaha.", "Masipag si Lito.", "Tahimik ang silid."], "Ang ulan ang sanhi at ang baha ang bunga."],
  ],
  6: [
    ["Ano ang layunin ng tekstong argumentatibo?", "Manghikayat gamit ang dahilan at ebidensya", ["Maglista lamang", "Manghikayat gamit ang dahilan at ebidensya", "Magbigay ng bugtong", "Maglarawan nang walang paninindigan"], "Ang argumento ay sinusuportahan ng katuwiran at ebidensya."],
    ["Alin ang pinakamapananaligang sanggunian?", "Opisyal na ulat na may datos at may-akda", ["Hindi kilalang post", "Tsismis", "Opisyal na ulat na may datos at may-akda", "Patalastas"], "Mahalaga ang malinaw na pinagmulan at ebidensya."],
  ],
};

function bankQuestion(bank, grade, index) {
  const gradeNumber = Number(normalizeGradeLevel(grade).replace(/\D/g, "")) || 3;
  const rows = bank[gradeNumber] || bank[3];
  const [prompt, answer, choices, explanation] = rows[index % rows.length];
  return {
    prompt,
    answer,
    choices: shuffle(choices, index * 31 + gradeNumber),
    explanation,
    skill: "Comprehension",
  };
}

function normalizeTeacherQuestion(question, index) {
  if (!question || typeof question !== "object") return null;
  const prompt = String(question.prompt || question.question || question.text || "").trim();
  const sourceChoices = question.choices || question.options || [];
  const choices = Array.isArray(sourceChoices)
    ? sourceChoices.map((choice) => String(choice?.text ?? choice)).filter(Boolean)
    : Object.values(sourceChoices).map(String);
  const indexedAnswer = Number.isInteger(Number(question.answerIndex))
    ? choices[Number(question.answerIndex)]
    : undefined;
  const answer = String(question.answer ?? question.correctAnswer ?? question.correct ?? indexedAnswer ?? "").trim();
  if (!prompt || !answer) return null;

  const unique = [...new Set(choices.map(String).filter(Boolean))];
  if (!unique.some((choice) => choice.toLocaleLowerCase() === answer.toLocaleLowerCase())) {
    unique.unshift(answer);
  }
  while (unique.length < 2) {
    unique.push(unique.length === 0 ? answer : "A different answer");
  }
  let visibleChoices = unique.slice(0, 4);
  if (!visibleChoices.some((choice) => choice.toLocaleLowerCase() === answer.toLocaleLowerCase())) {
    visibleChoices = [...visibleChoices.slice(0, 3), answer];
  }

  return {
    id: `teacher-${index}`,
    prompt,
    answer,
    choices: shuffle(visibleChoices, index + 71),
    explanation: String(question.explanation || question.rationale || `The correct answer is ${answer}.`),
    skill: String(question.skill || question.competency || "Teacher challenge"),
  };
}

export function buildGameQuestions(game, grade, level = 1, count = 10, options = {}) {
  const teacherQuestions = Array.isArray(game?.questions)
    ? game.questions.map(normalizeTeacherQuestion).filter(Boolean)
    : [];
  if (teacherQuestions.length) {
    return Array.from({ length: count }, (_, index) => ({
      ...teacherQuestions[index % teacherQuestions.length],
      id: `teacher-${index}`,
    }));
  }

  const subject = String(game?.subject || "Mathematics").toLowerCase();
  const weekKey = String(options.weekKey || "");
  const missionSeed = weeklySeed(weekKey);
  return Array.from({ length: count }, (_, index) => {
    let question;
    if (subject.includes("math")) question = mathQuestion(grade, index + 1, level, missionSeed);
    else if (subject.includes("science")) question = bankQuestion(SCIENCE_BANK, grade, index);
    else if (subject.includes("filipino")) question = bankQuestion(FILIPINO_BANK, grade, index);
    else question = bankQuestion(LANGUAGE_BANK, grade, index);
    return { ...question, id: `generated-${weekKey || "standard"}-level-${level}-${index}`, ...(weekKey ? { weekKey } : {}) };
  });
}

export function calculateStars(score, maximumScore) {
  const percent = maximumScore ? (score / maximumScore) * 100 : 0;
  if (percent >= 85) return 3;
  if (percent >= 60) return 2;
  if (percent >= 30) return 1;
  return 0;
}

export function gameTimerForGrade(grade, difficulty = 1) {
  return Math.max(12, getGradeExperience(grade).roundSeconds - (difficulty - 1) * 3);
}

export function cameraCardsForQuestion(question) {
  return question.choices.slice(0, 4).map((value, index) => ({
    value: String(value),
    ...CAMERA_CARD_COLORS[index],
  }));
}
