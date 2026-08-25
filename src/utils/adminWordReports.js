const SCHOOL_NAME = "Jidanao Elementary School";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readableDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}

function reportDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function download(filename, content) {
  const blob = new Blob([`\ufeff${content}`], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

let schoolSealPromise;

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

async function getSchoolSeal() {
  if (!schoolSealPromise) {
    schoolSealPromise = fetch("/school-logo.jpg")
      .then((response) => {
        if (!response.ok) throw new Error("School seal could not be loaded.");
        return response.blob();
      })
      .then(readBlobAsDataUrl)
      .catch(() => "");
  }
  return schoolSealPromise;
}

function reportTable(headers, rows, emptyMessage = "No records are available for this report.") {
  const heading = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${headers.length}">${escapeHtml(emptyMessage)}</td></tr>`;
  return `<table class="report-table"><thead><tr>${heading}</tr></thead><tbody>${body}</tbody></table>`;
}

function summaryCards(items) {
  return `<table class="summary-table"><tr>${items.map((item) => `<td><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></td>`).join("")}</tr></table>`;
}

async function createWordDocument({ title, description, summary, sections, note }) {
  const generatedAt = new Date();
  const seal = await getSchoolSeal();
  return `<!DOCTYPE html>
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 38pt 38pt 42pt; }
        div.Section1 { page: Section1; }
        body { margin: 0; color: #10264d; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.45; }
        .report-header { width: 100%; border-collapse: collapse; background: #074fb7; border-bottom: 6px solid #f4c430; }
        .report-header td { padding: 18px 22px; border: 0; color: #fff; background: #074fb7; }
        .report-header .logo-cell { width: 68px; padding-right: 0; }
        .school-logo { width: 58px; height: 58px; border: 3px solid #fff; border-radius: 50%; }
        .school-name { margin: 0 0 4px; color: #ffe274; font-size: 8.5pt; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
        .report-header h1 { margin: 0; color: #fff; font-size: 23pt; line-height: 1.12; }
        .report-header p { margin: 5px 0 0; color: #eaf2ff; font-size: 9.5pt; }
        .report-meta { margin: 13px 0 10px; padding: 9px 12px; border: 1px solid #cedcf0; background: #f3f7fd; }
        .summary-table { width: 100%; margin: 0 0 18px; border-collapse: separate; border-spacing: 7px; table-layout: fixed; }
        .summary-table td { padding: 11px 8px; border: 1px solid #d7e2f0; background: #f8fbff; text-align: center; }
        .summary-table strong { display: block; color: #0753bd; font-size: 18pt; line-height: 1.05; }
        .summary-table span { display: block; margin-top: 4px; color: #61738e; font-size: 8pt; font-weight: bold; text-transform: uppercase; }
        h2 { margin: 20px 0 8px; padding: 7px 10px; color: #fff; background: #0b5fd2; font-size: 13pt; page-break-after: avoid; }
        .section-description { margin: -2px 0 8px; color: #5d708d; }
        .report-table { width: 100%; margin-bottom: 14px; border-collapse: collapse; page-break-inside: auto; }
        .report-table tr { page-break-inside: avoid; page-break-after: auto; }
        .report-table th { padding: 7px 8px; border: 1px solid #afc3de; color: #fff; background: #174f9e; font-size: 8pt; text-align: left; }
        .report-table td { padding: 6px 8px; border: 1px solid #d5dfec; color: #20395e; font-size: 8pt; vertical-align: top; }
        .report-table tbody tr:nth-child(even) td { background: #f5f8fc; }
        .empty { padding: 15px !important; color: #6e8097 !important; text-align: center; }
        .report-note { margin-top: 19px; padding: 10px 12px; border-left: 4px solid #f4c430; color: #526984; background: #fff9df; }
        .signatures { width: 100%; margin-top: 34px; border-collapse: separate; border-spacing: 35px 0; }
        .signatures td { padding-top: 24px; border: 0; border-top: 1px solid #526984; color: #425a78; font-size: 8pt; text-align: center; }
        .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #c9d6e7; color: #718198; font-size: 7.5pt; text-align: center; }
      </style>
    </head>
    <body>
      <div class="Section1">
        <table class="report-header"><tr>
          ${seal ? `<td class="logo-cell"><img class="school-logo" src="${seal}" alt="School seal" /></td>` : ""}
          <td><p class="school-name">${SCHOOL_NAME}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></td>
        </tr></table>
        <div class="report-meta"><strong>Generated:</strong> ${escapeHtml(readableDate(generatedAt))} &nbsp; | &nbsp; <strong>Document type:</strong> Official LMS administrative report</div>
        ${summaryCards(summary)}
        ${sections.map((section, index) => `<section><h2>${index + 1}. ${escapeHtml(section.title)}</h2>${section.description ? `<p class="section-description">${escapeHtml(section.description)}</p>` : ""}${section.content}</section>`).join("")}
        <div class="report-note"><strong>Report note:</strong> ${escapeHtml(note)}</div>
        <table class="signatures"><tr><td>Prepared by / LMS Administrator</td><td>Reviewed by / School Head</td></tr></table>
        <div class="footer">Generated by Jidanao LearnSpace · ${SCHOOL_NAME}</div>
      </div>
    </body>
  </html>`;
}

export async function exportGradeEngagementWordReport(overview) {
  const rows = overview?.gradeEngagement || [];
  const totalStudents = rows.reduce((sum, row) => sum + Number(row.students || 0), 0);
  const totalPlays = rows.reduce((sum, row) => sum + Number(row.gamePlays || 0), 0);
  const totalGamesTouched = rows.reduce((sum, row) => sum + Number(row.gamesTouched || 0), 0);
  const totalLessons = rows.reduce((sum, row) => sum + Number(row.lessonCompletions || 0), 0);
  const mostActive = [...rows].sort((a, b) => Number(b.gamePlays || 0) - Number(a.gamePlays || 0))[0];
  const tableRows = rows.map((row) => [
    row.grade || "Grade not set",
    row.students || 0,
    row.gamePlays || 0,
    row.gamesTouched || 0,
    row.lessonCompletions || 0,
    row.students ? (Number(row.gamePlays || 0) / Number(row.students)).toFixed(1) : "0.0",
  ]);

  const documentHtml = await createWordDocument({
    title: "Grade Engagement Report",
    description: "Student participation in games and completed lessons by grade level.",
    summary: [
      { label: "Students", value: totalStudents },
      { label: "Game plays", value: totalPlays },
      { label: "Games touched", value: totalGamesTouched },
      { label: "Lesson completions", value: totalLessons },
    ],
    sections: [
      {
        title: "Engagement by Grade",
        description: "Use this table to compare participation and identify grade levels that may need additional learning activities.",
        content: reportTable(["Grade", "Students", "Game plays", "Unique games", "Lesson completions", "Plays per learner"], tableRows),
      },
      {
        title: "Administrative Summary",
        content: `<p>${escapeHtml(mostActive?.grade || "No grade")} recorded the highest game activity with <strong>${escapeHtml(mostActive?.gamePlays || 0)}</strong> plays. Figures reflect activity stored in the LMS at the time of export.</p>`,
      },
    ],
    note: "Engagement totals are monitoring indicators and should be interpreted together with classroom performance, attendance, and teacher observations.",
  });
  download(`jidanao-grade-engagement-report-${reportDateKey()}.doc`, documentHtml);
}

export async function exportAccountDirectoryWordReport(overview) {
  const users = overview?.users || [];
  const active = users.filter((user) => user.status !== "disabled").length;
  const disabled = users.filter((user) => user.status === "disabled").length;
  const roleOrder = { admin: 0, teacher: 1, student: 2 };
  const tableRows = [...users]
    .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || String(a.name || a.email).localeCompare(String(b.name || b.email)))
    .map((user) => [
      user.name || "Unnamed account",
      user.email || "—",
      user.role || "—",
      user.employeeId || "—",
      user.gradeLevel || user.grade || "—",
      user.section || "—",
      user.status || "active",
      readableDate(user.createdAt),
    ]);

  const documentHtml = await createWordDocument({
    title: "Account Directory Report",
    description: "Administrator, teacher, and student account directory with current placement and status.",
    summary: [
      { label: "Administrators", value: overview?.totals?.administrators || 0 },
      { label: "Teachers", value: overview?.totals?.teachers || 0 },
      { label: "Students", value: overview?.totals?.students || 0 },
      { label: "Active accounts", value: active },
      { label: "Disabled", value: disabled },
    ],
    sections: [
      {
        title: "LMS Account Directory",
        description: "Accounts are grouped by role and alphabetized for easier administrative review.",
        content: reportTable(["Name", "Email", "Role", "Employee ID", "Grade", "Section", "Status", "Created"], tableRows),
      },
    ],
    note: "This directory is for authorized school use only. Passwords, authentication credentials, profile photos, and biometric data are not included.",
  });
  download(`jidanao-account-directory-report-${reportDateKey()}.doc`, documentHtml);
}

export async function exportLearningContentWordReport(overview) {
  const content = overview?.content || [];
  const usersById = Object.fromEntries((overview?.users || []).map((user) => [user.uid, user]));
  const lessons = content.filter((item) => item.type === "lesson").length;
  const games = content.filter((item) => item.type === "game").length;
  const published = content.filter((item) => item.status === "published").length;
  const drafts = content.filter((item) => item.status !== "published").length;
  const tableRows = [...content]
    .sort((a, b) => String(a.grade || a.gradeLevel).localeCompare(String(b.grade || b.gradeLevel)) || String(a.title).localeCompare(String(b.title)))
    .map((item) => [
      item.title || "Untitled content",
      item.type || "content",
      item.grade || item.gradeLevel || "—",
      item.section || "All assigned sections",
      item.subject || "—",
      item.status || "draft",
      usersById[item.teacherId]?.name || item.teacherName || "System / not set",
      readableDate(item.updatedAt || item.createdAt),
    ]);

  const documentHtml = await createWordDocument({
    title: "Learning Content Report",
    description: "Inventory of LMS lessons and learning games by class, subject, owner, and publication status.",
    summary: [
      { label: "All content", value: content.length },
      { label: "Lessons", value: lessons },
      { label: "Games", value: games },
      { label: "Published", value: published },
      { label: "Drafts", value: drafts },
    ],
    sections: [
      {
        title: "Learning Content Inventory",
        description: "Published items are available to their assigned learners; drafts remain inside the teacher or administrator workspace.",
        content: reportTable(["Title", "Type", "Grade", "Section", "Subject", "Status", "Teacher / owner", "Last updated"], tableRows),
      },
    ],
    note: "This report contains metadata only. Full lesson discussions, quiz answers, private files, and student submissions are not included.",
  });
  download(`jidanao-learning-content-report-${reportDateKey()}.doc`, documentHtml);
}
