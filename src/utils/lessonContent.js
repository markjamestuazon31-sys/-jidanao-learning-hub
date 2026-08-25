function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    return String(value.text ?? value.label ?? value.value ?? value.title ?? "").trim();
  }
  return "";
}

export function textArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item.description ?? item.instructions ?? item))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeChoices(source) {
  const rawChoices = Array.isArray(source)
    ? source
    : source && typeof source === "object"
      ? Object.values(source)
      : [];

  return rawChoices
    .map(toText)
    .filter(Boolean)
    .filter((choice, index, choices) => choices.indexOf(choice) === index);
}

function resolveAnswer(question, choices) {
  const explicitIndex = Number(question.answerIndex);
  if (
    Number.isInteger(explicitIndex) &&
    explicitIndex >= 0 &&
    explicitIndex < choices.length &&
    question.answerIndex !== ""
  ) {
    return choices[explicitIndex];
  }

  const rawAnswer = question.answer ?? question.correctAnswer ?? question.correct;
  if (rawAnswer === null || rawAnswer === undefined || rawAnswer === "") return "";

  const directAnswer = toText(rawAnswer);
  if (!directAnswer) return "";

  if (/^[A-D]$/i.test(directAnswer) && choices.length) {
    const choiceIndex = directAnswer.toUpperCase().charCodeAt(0) - 65;
    return choices[choiceIndex] ?? "";
  }

  const exactChoice = choices.find(
    (choice) => choice.toLocaleLowerCase() === directAnswer.toLocaleLowerCase(),
  );
  if (exactChoice) return exactChoice;

  const legacyIndex = Number(directAnswer);
  if (
    Number.isInteger(legacyIndex) &&
    legacyIndex >= 0 &&
    legacyIndex < choices.length &&
    !choices.includes(directAnswer)
  ) {
    return choices[legacyIndex];
  }

  return directAnswer;
}

function choicesWithGuaranteedAnswer(choices, answer) {
  const normalizedAnswer = toText(answer);
  const unique = choices.filter(
    (choice, index, values) => values.indexOf(choice) === index,
  );

  const answerIndex = unique.findIndex(
    (choice) => choice.toLocaleLowerCase() === normalizedAnswer.toLocaleLowerCase(),
  );

  if (answerIndex === -1) unique.unshift(normalizedAnswer);
  if (unique.length <= 4) return unique;

  const firstFour = unique.slice(0, 4);
  if (
    firstFour.some(
      (choice) => choice.toLocaleLowerCase() === normalizedAnswer.toLocaleLowerCase(),
    )
  ) {
    return firstFour;
  }

  return [...unique.slice(0, 3), normalizedAnswer];
}

export function normalizeQuestion(question, index, prefix = "question", options = {}) {
  if (!question || typeof question !== "object") return null;
  const { requireAnswer = true } = options;

  const prompt = toText(question.question ?? question.prompt ?? question.text);
  const sourceChoices = normalizeChoices(
    question.choices ?? question.options ?? question.answers,
  );
  const answer = resolveAnswer(question, sourceChoices);

  if (!prompt || (requireAnswer && !answer)) return null;

  const choices = answer
    ? choicesWithGuaranteedAnswer(sourceChoices, answer)
    : sourceChoices.slice(0, 4);
  if (choices.length < 2) {
    if (!answer) return null;
    choices.push("Not enough information", "A different answer", "None of these");
  }

  return {
    id: toText(question.id) || `${prefix}-${index + 1}`,
    prompt,
    answer,
    choices: choices.slice(0, 4),
    explanation: toText(question.explanation ?? question.rationale)
      || (answer ? `The correct answer is ${answer}.` : ""),
  };
}

function questionSignature(question) {
  return String(question?.prompt || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeQuestionList(source, prefix, options = {}) {
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  return source
    .map((question, index) => normalizeQuestion(question, index, prefix, options))
    .filter(Boolean)
    .filter((question) => {
      const signature = questionSignature(question);
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function fallbackPracticeQuestions(lesson, objectives) {
  const subject = toText(lesson.subject) || "General";
  const title = toText(lesson.title) || "this lesson";
  const primaryObjective = objectives[0] || `Understand the main idea of ${title}.`;

  return [
    {
      id: "practice-learning-goal",
      prompt: "Which goal belongs to this lesson?",
      answer: primaryObjective,
      choices: [
        primaryObjective,
        "Skip the examples and guess every answer.",
        "Study a completely unrelated subject.",
        "Finish without checking your understanding.",
      ],
      explanation: `This lesson is designed to help you: ${primaryObjective}`,
    },
    {
      id: "practice-learning-strategy",
      prompt: `Which strategy will help you learn ${subject} in this activity?`,
      answer: "Read carefully, use the examples, and check your work",
      choices: [
        "Read carefully, use the examples, and check your work",
        "Choose answers without reading the question",
        "Ignore feedback after each attempt",
        "Skip the lesson and only guess",
      ],
      explanation: "Careful reading, guided examples, practice, and feedback support stronger learning.",
    },
  ];
}

function fallbackQuizQuestions(lesson) {
  const subject = toText(lesson.subject) || "General";
  const title = toText(lesson.title) || "Learning lesson";
  return [
    {
      id: "fallback-topic",
      prompt: "What is the main topic of this lesson?",
      answer: title,
      choices: [title, `${subject} review only`, "An unrelated topic", "No topic is given"],
      explanation: `The lesson is titled “${title},” which identifies its main topic.`,
    },
    {
      id: "fallback-subject",
      prompt: "Which subject does this learning activity belong to?",
      answer: subject,
      choices: [subject, "Physical Education", "Music", "Technology"].filter(
        (value, index, values) => values.indexOf(value) === index,
      ),
      explanation: `This lesson is categorized under ${subject}.`,
    },
    {
      id: "fallback-strategy",
      prompt: "Which learning habit will help you complete this lesson well?",
      answer: "Read carefully and check your work",
      choices: [
        "Read carefully and check your work",
        "Guess without reading",
        "Skip every example",
        "Ignore feedback",
      ],
      explanation: "Careful reading, practice, and checking improve learning accuracy.",
    },
  ];
}

function readQuestionSource(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.questions)) {
    return value.questions;
  }
  return [];
}

export function normalizeLesson(raw = {}) {
  const objectives = textArray(raw.learningObjectives || raw.objectives);
  const discussion = textArray(raw.discussion || raw.content || raw.description);
  const examples = textArray(raw.examples || raw.workedExamples || raw.sampleProblems);
  const activities = Array.isArray(raw.activities)
    ? raw.activities
    : textArray(raw.activities);

  const normalizedObjectives = objectives.length
    ? objectives
    : [
        `Explain the main idea of ${raw.title}.`,
        "Apply the lesson idea in guided practice.",
        "Show understanding through a short quiz and challenge.",
      ];

  const quizSource = readQuestionSource(raw.quiz).length
    ? readQuestionSource(raw.quiz)
    : readQuestionSource(raw.assessment).length
      ? readQuestionSource(raw.assessment)
      : readQuestionSource(raw.questions);

  const practiceSource = readQuestionSource(raw.practice).length
    ? readQuestionSource(raw.practice)
    : readQuestionSource(raw.practiceQuestions).length
      ? readQuestionSource(raw.practiceQuestions)
      : [];

  // In the Realtime-Database-only edition the full authorized lesson is read by
  // the browser, so a mastery item must retain a normalized answer. Legacy
  // answerIndex/answer/correctAnswer/correct formats are handled by resolveAnswer.
  const quizQuestions = normalizeQuestionList(quizSource, "quiz");
  const safeQuizQuestions = quizQuestions.length
    ? quizQuestions.slice(0, 5)
    : fallbackQuizQuestions(raw);
  const quizSignatures = new Set(safeQuizQuestions.map(questionSignature));

  const explicitPracticeQuestions = normalizeQuestionList(practiceSource, "practice")
    .filter((question) => !quizSignatures.has(questionSignature(question)))
    .slice(0, 2);

  const fallbackPractice = fallbackPracticeQuestions(raw, normalizedObjectives)
    .filter((question) => !quizSignatures.has(questionSignature(question)));

  const practiceQuestions = [...explicitPracticeQuestions];
  for (const question of fallbackPractice) {
    if (practiceQuestions.length >= 2) break;
    if (!practiceQuestions.some((item) => questionSignature(item) === questionSignature(question))) {
      practiceQuestions.push(question);
    }
  }

  return {
    ...raw,
    objectives: normalizedObjectives,
    discussion: discussion.length
      ? discussion
      : [raw.description || `Explore the key ideas in ${raw.title}.`],
    examples: examples.length
      ? examples
      : [
          "Study the teacher explanation carefully.",
          "Notice the steps or evidence used in the example.",
          "Try the same strategy with a new problem.",
        ],
    activities,
    practiceQuestions,
    quizQuestions: safeQuizQuestions,
    // Keep this compatibility alias for components that still expect `questions`.
    questions: safeQuizQuestions,
  };
}
