const REPORT_TIME_ZONE = "Asia/Manila";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function monthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
}

function dateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: REPORT_TIME_ZONE }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function exportAttendanceWordReport({ teacherName, classLabel, schoolYear, monthKey, students, summaries }) {
  const logoDataUrl = await imageAsDataUrl("/school-logo.jpg");
  const rows = students.map((student, index) => {
    const summary = summaries[student.uid] || { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    const rate = summary.total ? Math.round(((summary.present + summary.late) / summary.total) * 100) : 0;
    return `<tr><td class="center">${index + 1}</td><td><b>${escapeHtml(student.name)}</b><br><small>${escapeHtml(student.source === "shared-device" ? "Shared-device learner" : student.email || "Registered learner")}</small></td><td class="center">${summary.present}</td><td class="center">${summary.absent}</td><td class="center">${summary.late}</td><td class="center">${summary.excused}</td><td class="center">${summary.total}</td><td class="center"><b>${rate}%</b></td></tr>`;
  }).join("") || '<tr><td colspan="8" class="empty">No learner attendance records were available.</td></tr>';
  const generated = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: REPORT_TIME_ZONE }).format(new Date());
  const logo = logoDataUrl ? `<img src="${logoDataUrl}" alt="">` : "<b>JES</b>";
  const html = `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Monthly Attendance Tracking Report</title><style>
    @page Section1{size:11.69in 8.27in;margin:.55in;mso-page-orientation:landscape}div.Section1{page:Section1}*{box-sizing:border-box}body{margin:0;color:#172b49;font:10pt Arial,sans-serif}.head{width:100%;border-collapse:collapse;border-bottom:5px solid #f2bd16;background:#083f9e}.head td{padding:14px 17px;color:#fff}.head .logo{width:88px;text-align:center}.head img,.head .logo>b{width:62px;height:62px;border:3px solid #fff;border-radius:50%;background:#fff}.head .logo>b{display:table-cell;color:#083f9e;vertical-align:middle}.head small{color:#d9e9ff;font-weight:bold;letter-spacing:1px}.head h1{margin:4px 0;font-size:22pt}.head p{margin:0;color:#e7f0ff}.meta{width:100%;margin:13px 0;border-collapse:collapse;background:#f4f8fe}.meta td{width:25%;padding:9px 11px;border:1px solid #cbd9eb}.meta span{display:block;color:#687b94;font-size:7.5pt;font-weight:bold;text-transform:uppercase}.meta strong{display:block;margin-top:3px;color:#123e78}.records{width:100%;border-collapse:collapse;table-layout:fixed}.records th{padding:8px;border:1px solid #91aad0;color:#fff;background:#1761bb;font-size:8.5pt;text-align:left}.records td{padding:7px;border:1px solid #c5d2e3;font-size:8.5pt}.records tr:nth-child(even) td{background:#f5f8fc}.records .center{text-align:center}.records small{color:#6e8098}.empty{padding:25px!important;text-align:center}.note{margin:12px 0 0;padding:9px 11px;border-left:4px solid #efba13;background:#fff9e5;color:#5d6d84;font-size:8pt}.sign{width:100%;margin-top:27px;border-collapse:separate;border-spacing:28px 0}.sign td{width:33%;padding-top:28px;border-top:1px solid #64748b;text-align:center;font-size:8.5pt}.footer{margin-top:14px;padding-top:7px;border-top:1px solid #d2dce9;color:#738197;font-size:7.5pt;text-align:center}
  </style></head><body><div class="Section1"><table class="head"><tr><td class="logo">${logo}</td><td><small>JIDANAO LEARNSPACE · OFFICIAL CLASS RECORD</small><h1>Monthly Attendance Tracking Report</h1><p>Present, absent, late, and excused attendance summary by learner</p></td></tr></table><table class="meta"><tr><td><span>Teacher</span><strong>${escapeHtml(teacherName)}</strong></td><td><span>Class</span><strong>${escapeHtml(classLabel)}</strong></td><td><span>School year</span><strong>${escapeHtml(schoolYear)}</strong></td><td><span>Reporting month</span><strong>${escapeHtml(monthLabel(monthKey))}</strong></td></tr></table><table class="records"><colgroup><col style="width:5%"><col style="width:37%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:13%"></colgroup><thead><tr><th>No.</th><th>Learner</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Recorded</th><th>Attendance rate</th></tr></thead><tbody>${rows}</tbody></table><p class="note"><b>Privacy notice:</b> This report contains protected learner attendance information. Use it only for authorized school monitoring, intervention, and official documentation.</p><table class="sign"><tr><td>Prepared by: Class Teacher</td><td>Reviewed by: School Coordinator</td><td>Approved by: School Head</td></tr></table><div class="footer">Generated ${escapeHtml(generated)} · Jidanao Elementary School · Computer-generated attendance record</div></div></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jidanao-attendance-${String(classLabel).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${monthKey}-${dateKey()}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
