function cleanText(value, maxLength = 6000) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sentenceList(value) {
  return String(value || "")
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items.map((item) => cleanText(item)).filter(Boolean))];
}

function question(prompt, choices, answerIndex, rationale) {
  return { prompt, choices, answerIndex, rationale };
}

/**
 * Builds a structured, teacher-reviewable lesson draft locally. No API key or
 * Cloud Function is used in the Realtime-Database-only edition.
 */
export async function generateLessonWithAI(input) {
  const grade = cleanText(input?.grade, 30) || "Grade 3";
  const subject = cleanText(input?.subject, 80) || "General";
  const notes = sentenceList(input?.lessonPlan);
  if (notes.length === 0) {
    throw new Error("Add teacher source notes or import a readable lesson-plan document first.");
  }
  const competency = cleanText(input?.competency, 500)
    || `Understand and apply ${cleanText(notes[0], 180).replace(/[.!?]+$/, "").toLowerCase()}`;

  const titleIdea = competency.replace(/^(the learner|learners|students?)\s+/i, "");
  const title = `${subject}: ${titleIdea.slice(0, 72)}`;
  const keyIdea = notes[0];
  const secondIdea = notes[1] || `Use the teacher examples to explain ${competency.toLowerCase()}.`;
  const thirdIdea = notes[2] || "Check each answer and explain the strategy used.";

  return {
    title,
    summary: `${grade} ${subject} lesson focused on ${competency}.`,
    learningObjectives: unique([
      competency,
      `Explain the lesson idea using a ${grade} example.`,
      "Apply the idea independently and check the result.",
    ]),
    discussion: unique([keyIdea, secondIdea, thirdIdea, ...notes.slice(3, 8)]),
    activities: [
      { title: "Notice and explain", instructions: `Read the examples, then identify the idea connected to: ${competency}` },
      { title: "Try a new example", instructions: "Apply the same strategy to a new situation and explain each step." },
    ],
    practice: [
      question("Which action is the best first step in this lesson?", ["Read the example and identify the important information", "Guess immediately", "Skip every example", "Ignore the question"], 0, "Careful reading helps identify the information and strategy needed."),
      question("What should you do after trying the strategy?", ["Check the result and explain your thinking", "Erase all work", "Choose another topic", "Stop before checking"], 0, "Checking and explaining strengthen understanding."),
    ],
    quiz: [
      question("What is the main focus of this lesson?", [competency, "An unrelated activity", "Skipping examples", "Guessing without reading"], 0, `The stated competency is: ${competency}`),
      question("Which source should guide your answer?", ["The teacher-approved lesson and examples", "An unrelated guess", "A random advertisement", "No source"], 0, "Use the approved lesson content and examples."),
      question("Which habit supports accurate work?", ["Read, solve, and check", "Rush and skip steps", "Ignore feedback", "Copy without understanding"], 0, "Reading, solving, and checking improve accuracy."),
      question("What demonstrates understanding?", ["Explaining how the answer was reached", "Selecting without reading", "Leaving every item blank", "Changing the topic"], 0, "An explanation makes the learning process visible."),
      question("How should feedback be used?", ["Use it to revise and improve", "Ignore it", "Delete the lesson", "Avoid trying again"], 0, "Feedback helps learners correct and improve their work."),
    ],
    games: [
      { title: `${subject} Skill Sprint`, mechanic: "Solve grade-level rounds", learningGoal: competency },
      { title: "Explain and Earn", mechanic: "Choose a strategy and explain it", learningGoal: competency },
    ],
    generationMode: "local-teacher-template",
    sourceAnalysis: {
      sentenceCount: notes.length,
      sourceCharacters: cleanText(input?.lessonPlan, 120000).length,
      usedTeacherCompetency: Boolean(cleanText(input?.competency, 500)),
    },
  };
}

/** Searches only the authorized lesson already loaded in this browser. */
export async function askLearningAssistant({ lesson, question: learnerQuestion }) {
  const words = cleanText(learnerQuestion, 700)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  const candidates = unique([
    ...(lesson?.discussion || []),
    ...(lesson?.examples || []),
    ...(lesson?.objectives || []),
    lesson?.description,
  ]);
  const ranked = candidates
    .map((text) => ({
      text,
      score: words.reduce((total, word) => total + (text.toLowerCase().includes(word) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);
  const answer = ranked.find((item) => item.score > 0)?.text || candidates[0];
  return {
    answer: answer
      ? `From this lesson: ${answer}`
      : "Review the lesson discussion and examples, then ask your teacher if the idea is still unclear.",
  };
}
