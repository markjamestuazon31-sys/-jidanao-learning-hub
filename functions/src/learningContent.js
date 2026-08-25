function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    return String(value.text ?? value.label ?? value.value ?? value.title ?? "").trim();
  }
  return "";
}

function textArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item?.description ?? item?.instructions ?? item))
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

function normalizeChoices(source) {
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
    Number.isInteger(explicitIndex)
    && explicitIndex >= 0
    && explicitIndex < choices.length
    && question.answerIndex !== ""
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
    Number.isInteger(legacyIndex)
    && legacyIndex >= 0
    && legacyIndex < choices.length
    && !choices.includes(directAnswer)
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

function normalizeQuestion(question, index, prefix = "quiz") {
  if (!question || typeof question !== "object") return null;
  const prompt = toText(question.question ?? question.prompt ?? question.text);
  const sourceChoices = normalizeChoices(
    question.choices ?? question.options ?? question.answers,
  );
  const answer = resolveAnswer(question, sourceChoices);
  if (!prompt || !answer) return null;

  const choices = choicesWithGuaranteedAnswer(sourceChoices, answer);
  if (choices.length < 2) {
    choices.push("Not enough information", "A different answer", "None of these");
  }

  return {
    id: toText(question.id) || `${prefix}-${index + 1}`,
    prompt,
    answer,
    choices: choices.slice(0, 4),
    explanation: toText(question.explanation ?? question.rationale)
      || `The correct answer is ${answer}.`,
  };
}

function normalizeQuestionList(source, prefix) {
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  return source
    .map((question, index) => normalizeQuestion(question, index, prefix))
    .filter(Boolean)
    .filter((question) => {
      const signature = question.prompt.trim().toLocaleLowerCase().replace(/\s+/g, " ");
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
}

function readQuestionSource(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.questions)) {
    return value.questions;
  }
  return [];
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

export function lessonQuizQuestions(lesson = {}) {
  const quizSource = readQuestionSource(lesson.quiz).length
    ? readQuestionSource(lesson.quiz)
    : readQuestionSource(lesson.assessment).length
      ? readQuestionSource(lesson.assessment)
      : readQuestionSource(lesson.questions);

  const normalized = normalizeQuestionList(quizSource, "quiz");
  return normalized.length ? normalized.slice(0, 5) : fallbackQuizQuestions(lesson);
}

export function gradeLessonQuiz(lesson, answers = {}) {
  const questions = lessonQuizQuestions(lesson);
  const safeAnswers = answers && typeof answers === "object" ? answers : {};
  const answered = questions.filter(
    (question) => safeAnswers[question.id] !== undefined && safeAnswers[question.id] !== null,
  ).length;

  if (answered < questions.length) {
    return {
      complete: false,
      answered,
      total: questions.length,
      correct: 0,
      score: 0,
      feedback: [],
    };
  }

  let correct = 0;
  const feedback = questions.map((question) => {
    const selected = toText(safeAnswers[question.id]);
    const isCorrect = selected.toLocaleLowerCase() === question.answer.toLocaleLowerCase();
    if (isCorrect) correct += 1;
    return {
      id: question.id,
      correct: isCorrect,
      explanation: question.explanation,
    };
  });

  return {
    complete: true,
    answered,
    total: questions.length,
    correct,
    score: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    feedback,
  };
}

function cleanContextText(value, maxLength = 4500) {
  const text = toText(value);
  return text.slice(0, maxLength);
}

export function approvedLessonContext(lesson = {}) {
  const objectives = textArray(lesson.learningObjectives || lesson.objectives).slice(0, 6);
  const discussion = textArray(lesson.discussion || lesson.content || lesson.description).slice(0, 12);
  const examples = textArray(lesson.examples || lesson.workedExamples || lesson.sampleProblems).slice(0, 8);
  const activities = textArray(lesson.activities).slice(0, 6);

  return [
    `Title: ${cleanContextText(lesson.title, 300)}`,
    `Grade: ${cleanContextText(lesson.grade || lesson.gradeLevel, 50)}`,
    `Subject: ${cleanContextText(lesson.subject, 100)}`,
    lesson.description ? `Description: ${cleanContextText(lesson.description, 1200)}` : "",
    objectives.length ? `Learning objectives:\n- ${objectives.join("\n- ")}` : "",
    discussion.length ? `Approved discussion:\n${discussion.join("\n\n")}` : "",
    examples.length ? `Approved examples:\n- ${examples.join("\n- ")}` : "",
    activities.length ? `Approved activities:\n- ${activities.join("\n- ")}` : "",
    lesson.material?.text
      ? `Teacher material excerpt:\n${cleanContextText(lesson.material.text, 4500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 14000);
}

function sanitizedQuizQuestion(question) {
  return {
    id: question.id,
    question: question.prompt,
    choices: [...question.choices],
  };
}

/**
 * Returns the lesson shape that a student is allowed to receive.
 * Practice remains self-checking, but mastery-assessment answer keys and
 * rationales are removed. The callable quiz grader reads the authoritative
 * lesson record with the Admin SDK when the student submits answers.
 */
export function studentLessonPayload(lesson = {}) {
  const payload = JSON.parse(JSON.stringify(lesson));
  const quiz = lessonQuizQuestions(lesson).map(sanitizedQuizQuestion);

  payload.quiz = quiz;
  delete payload.assessment;
  delete payload.questions;

  // Internal ownership/admin metadata is unnecessary in the learner player.
  delete payload.teacherEmail;
  delete payload.internalNotes;
  delete payload.reviewNotes;

  return payload;
}
