const SCHOOL_NAME = "Jidanao Elementary School";
const SCHOOL_SYSTEM = "Jidanao LearnSpace";
const REPORT_TIME_ZONE = "Asia/Manila";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readableDateTime(value = new Date()) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: REPORT_TIME_ZONE,
  }).format(value);
}

function reportDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: REPORT_TIME_ZONE,
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function imageAsDataUrl(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function learningStatus(student) {
  const lessons = Number(student?.progress?.lessonsCompleted || 0);
  const games = Number(student?.progress?.gameSessions || 0);
  const accuracy = Number(student?.progress?.accuracyPercent || 0);
  if (student?.status === "disabled") return "Account disabled";
  if (lessons + games === 0) return "Needs participation";
  if (accuracy >= 80) return "Strong progress";
  if (accuracy >= 70) return "On track";
  return "Needs teacher support";
}

function summaryCard(label, value, note) {
  return `<td class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></td>`;
}

function studentRows(students) {
  if (!students.length) {
    return `<tr><td colspan="9" class="empty-row">No learner records were available for this report.</td></tr>`;
  }
  return students.map((student, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><b>${escapeHtml(student.name || "Unnamed learner")}</b><br><small>${escapeHtml(student.email || "No email")}</small></td>
      <td>${escapeHtml(student.gradeLevel || "—")}</td>
      <td>${escapeHtml(student.section || "—")}</td>
      <td class="center">${Number(student.progress?.lessonsCompleted || 0)}</td>
      <td class="center">${Number(student.progress?.gameSessions || 0)}</td>
      <td class="center">${Number(student.progress?.accuracyPercent || 0)}%</td>
      <td class="center">${Number(student.progress?.totalXp || 0)}</td>
      <td>${escapeHtml(learningStatus(student))}</td>
    </tr>`).join("");
}

function buildDocument({ teacherName, classLabel, students, totals, logoDataUrl }) {
  const logo = logoDataUrl
    ? `<img class="school-logo" src="${logoDataUrl}" alt="">`
    : `<div class="logo-fallback">JES</div>`;
  return `<!doctype html>
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="en">
  <head>
    <meta charset="utf-8">
    <title>Teacher Class Progress Report</title>
    <style>
      @page Section1 { size: 11.69in 8.27in; margin: .52in; mso-page-orientation: landscape; }
      div.Section1 { page: Section1; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #14213d; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.42; }
      .report-header { width: 100%; border-collapse: collapse; border-bottom: 5px solid #f2b705; background: #083a9d; }
      .report-header td { padding: 15px 18px; color: #fff; vertical-align: middle; }
      .logo-cell { width: 90px; text-align: center; }
      .school-logo, .logo-fallback { width: 65px; height: 65px; border: 3px solid #fff; border-radius: 50%; background: #fff; }
      .logo-fallback { display: table-cell; color: #083a9d; font-size: 15pt; font-weight: bold; vertical-align: middle; }
      .report-kicker { margin: 0 0 3px; color: #d7e6ff; font-size: 8.5pt; font-weight: bold; letter-spacing: 1.2px; }
      .report-title { margin: 0; color: #fff; font-size: 23pt; line-height: 1.08; }
      .report-subtitle { margin: 5px 0 0; color: #e3edff; font-size: 9.5pt; }
      .meta-table, .summary-table, .records-table, .signature-table { width: 100%; border-collapse: collapse; }
      .meta-table { margin: 14px 0 12px; border: 1px solid #cfdbed; background: #f7faff; }
      .meta-table td { width: 33.333%; padding: 9px 11px; border-right: 1px solid #cfdbed; }
      .meta-table td:last-child { border-right: 0; }
      .meta-table span, .summary-card span { display: block; color: #60718e; font-size: 7.5pt; font-weight: bold; letter-spacing: .7px; text-transform: uppercase; }
      .meta-table strong { display: block; margin-top: 3px; color: #103b7a; font-size: 10.5pt; }
      .summary-table { margin: 0 0 13px; border-spacing: 7px 0; border-collapse: separate; }
      .summary-card { width: 25%; padding: 10px 12px; border: 1px solid #d7e2f1; background: #fbfdff; }
      .summary-card strong { display: block; margin: 3px 0 1px; color: #073f9c; font-size: 18pt; line-height: 1; }
      .summary-card small { color: #71809a; font-size: 7.5pt; }
      .section-title { margin: 7px 0 7px; color: #123f80; font-size: 13pt; }
      .records-table { table-layout: fixed; border: 1px solid #9fb7d7; }
      .records-table th { padding: 7px 6px; border: 1px solid #9fb7d7; color: #fff; background: #1559bd; font-size: 8pt; text-align: left; }
      .records-table td { padding: 6px; border: 1px solid #cbd7e7; color: #21324d; font-size: 8.2pt; vertical-align: top; }
      .records-table tr:nth-child(even) td { background: #f5f8fc; }
      .records-table small { color: #687894; font-size: 7pt; }
      .records-table .center { text-align: center; }
      .empty-row { padding: 24px !important; color: #6c7b92 !important; text-align: center; }
      .report-note { margin: 12px 0 0; padding: 9px 11px; border-left: 4px solid #f2b705; color: #566781; background: #fff9e7; font-size: 8pt; }
      .signature-table { margin-top: 26px; }
      .signature-table td { width: 33.333%; padding: 0 18px; text-align: center; }
      .signature-line { margin-top: 27px; padding-top: 5px; border-top: 1px solid #5d6d84; color: #253957; font-size: 8.5pt; }
      .footer { margin-top: 15px; padding-top: 7px; border-top: 1px solid #d3ddea; color: #738099; font-size: 7.5pt; text-align: center; }
    </style>
  </head>
  <body><div class="Section1">
    <table class="report-header"><tr><td class="logo-cell">${logo}</td><td><p class="report-kicker">${SCHOOL_SYSTEM.toUpperCase()} · OFFICIAL CLASS RECORD</p><h1 class="report-title">Teacher Class Progress Report</h1><p class="report-subtitle">Learner engagement, completion, game participation, accuracy, and achievement summary</p></td></tr></table>
    <table class="meta-table"><tr><td><span>Teacher</span><strong>${escapeHtml(teacherName)}</strong></td><td><span>Class scope</span><strong>${escapeHtml(classLabel)}</strong></td><td><span>Generated</span><strong>${escapeHtml(readableDateTime())}</strong></td></tr></table>
    <table class="summary-table"><tr>
      ${summaryCard("Learners", totals.learners, "Included in this report")}
      ${summaryCard("Lessons completed", totals.lessons, "Recorded completions")}
      ${summaryCard("Average accuracy", `${totals.accuracy}%`, "Across included learners")}
      ${summaryCard("Games played", totals.games, "Recorded game sessions")}
    </tr></table>
    <h2 class="section-title">Learner Performance Records</h2>
    <table class="records-table">
      <colgroup><col style="width:4%"><col style="width:22%"><col style="width:9%"><col style="width:11%"><col style="width:9%"><col style="width:8%"><col style="width:8%"><col style="width:7%"><col style="width:22%"></colgroup>
      <thead><tr><th>No.</th><th>Learner</th><th>Grade</th><th>Section</th><th>Lessons</th><th>Games</th><th>Accuracy</th><th>XP</th><th>Progress observation</th></tr></thead>
      <tbody>${studentRows(students)}</tbody>
    </table>
    <p class="report-note"><b>Privacy notice:</b> This document contains protected student education records. Use it only for authorized school monitoring, parent conferences, intervention planning, and official documentation. Store and dispose of it securely.</p>
    <table class="signature-table"><tr><td><div class="signature-line">Prepared by: Class Teacher</div></td><td><div class="signature-line">Reviewed by: School Coordinator</div></td><td><div class="signature-line">Approved by: School Head</div></td></tr></table>
    <div class="footer">${SCHOOL_NAME} · ${SCHOOL_SYSTEM} · Computer-generated class progress report</div>
  </div></body></html>`;
}

export async function exportTeacherClassWordReport({ teacherName, classLabel, students, totals }) {
  const logoDataUrl = await imageAsDataUrl("/school-logo.jpg");
  const html = buildDocument({ teacherName, classLabel, students, totals, logoDataUrl });
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jidanao-teacher-class-progress-${reportDateKey()}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
