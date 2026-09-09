function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function statusLabel(score) {
  const value = Number(score || 0);
  if (value >= 90) return "Outstanding";
  if (value >= 85) return "Very Satisfactory";
  if (value >= 80) return "Satisfactory";
  if (value >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

export function generateStudentGradesWordReport({ student, rows, schoolName = "Jidanao Elementary School" }) {
  const studentName = student?.name || "Student";
  const studentEmail = student?.email || student?.userEmail || "No email on file";
  const generatedAt = new Date();
  const sortedRows = [...rows].sort((first, second) => {
    const yearOrder = String(first.schoolYear || "").localeCompare(String(second.schoolYear || ""));
    if (yearOrder !== 0) return yearOrder;
    return String(first.period || "").localeCompare(String(second.period || ""));
  });

  const tableRows = sortedRows.length
    ? sortedRows
        .map(
          (row) => `
        <tr>
          <td>${escapeHtml(row.subject || "Subject")}</td>
          <td>${escapeHtml(String(row.schoolYear || "Current school year"))}</td>
          <td>${escapeHtml(String(row.period || "Grading period"))}</td>
          <td>${escapeHtml(String(row.score ?? "—"))}</td>
          <td>${escapeHtml(row.remarks || statusLabel(row.score))}</td>
        </tr>`,
        )
        .join("")
    : `
      <tr>
        <td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No released grades were found for this student.</td>
      </tr>`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Student Grade Report</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            background: #ffffff;
          }
          .page {
            padding: 36px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .school {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
          }
          .meta {
            font-size: 12px;
            color: #475569;
          }
          .card {
            border: 1px solid #dbeafe;
            border-radius: 14px;
            padding: 18px 20px;
            background: #f8fbff;
            margin-bottom: 22px;
          }
          .card-title {
            margin: 0 0 12px;
            font-size: 15px;
            letter-spacing: 0.08em;
            color: #2563eb;
            text-transform: uppercase;
          }
          .student-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(200px, 1fr));
            gap: 12px 18px;
          }
          .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .label {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            color: #64748b;
            text-transform: uppercase;
          }
          .value {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #dbeafe;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
            font-size: 12px;
          }
          th {
            background: #eff6ff;
            color: #1d4ed8;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          td {
            color: #334155;
          }
          .footer {
            margin-top: 24px;
            font-size: 11px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <div class="school">${escapeHtml(schoolName)}</div>
              <div class="meta">Learner Grade Summary Report</div>
            </div>
            <div class="meta">Generated: ${escapeHtml(new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(generatedAt))}</div>
          </div>

          <div class="card">
            <h3 class="card-title">Student information</h3>
            <div class="student-grid">
              <div class="field">
                <span class="label">Student name</span>
                <span class="value">${escapeHtml(studentName)}</span>
              </div>
              <div class="field">
                <span class="label">Email</span>
                <span class="value">${escapeHtml(studentEmail)}</span>
              </div>
              <div class="field">
                <span class="label">Grade level</span>
                <span class="value">${escapeHtml(String(student?.gradeLevel || "—"))}</span>
              </div>
              <div class="field">
                <span class="label">Section</span>
                <span class="value">${escapeHtml(String(student?.section || "—"))}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">Released grade details</h3>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>School year</th>
                  <th>Grading period</th>
                  <th>Grade</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>

          <div class="footer">
            This report is generated for academic review and documentation purposes only.
          </div>
        </div>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `student-grade-report-${studentName.replace(/\s+/g, "-")}-${reportDateKey(generatedAt)}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
