function escapePdfText(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7E]/g, "");
}

export function generateCertificate({ studentName, title, date = new Date() }) {
  const lines = [
    { text: "Certificate of Achievement", size: 30, y: 470 },
    { text: "Jidanao Elementary School", size: 17, y: 430 },
    { text: "This certificate is proudly presented to", size: 14, y: 375 },
    { text: studentName || "Student", size: 25, y: 325 },
    { text: `for completing ${title || "a learning milestone"}.`, size: 14, y: 275 },
    { text: date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }), size: 13, y: 220 },
  ];
  const content = lines.map(({ text, size, y }) => `BT /F1 ${size} Tf 0 0 0 rg 421 ${y} Td (${escapePdfText(text)}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
  ];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  for (const obj of objects) { offsets.push(pdf.length); pdf += `${obj}\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `Jidanao-Certificate-${(studentName || "Student").replace(/\s+/g, "-")}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfText(text, x, y, size = 10, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 0 0 0 rg ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function pdfLine(x1, y1, x2, y2, width = 0.6) {
  return `${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function downloadPortraitPdf(content, filename) {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => { offsets.push(pdf.length); pdf += `${object}\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function periodNumber(value) {
  const match = String(value || "").match(/[1-4]/);
  return match ? Number(match[0]) : 1;
}

export function generateReportCard({ student, grades, schoolYear, schoolName = "Jidanao Elementary School" }) {
  const selected = (grades || []).filter((grade) => !schoolYear || grade.schoolYear === schoolYear);
  if (!selected.length) throw new Error("No released grades are available for the selected school year.");
  const subjects = [...new Set(selected.map((grade) => grade.subject))].sort();
  const scoreMap = Object.fromEntries(selected.map((grade) => [`${grade.subject}|${periodNumber(grade.period)}`, Number(grade.score)]));
  const rowAverages = Object.fromEntries(subjects.map((subject) => {
    const scores = [1, 2, 3, 4].map((period) => scoreMap[`${subject}|${period}`]).filter(Number.isFinite);
    return [subject, scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null];
  }));
  const allScores = selected.map((grade) => Number(grade.score)).filter(Number.isFinite);
  const generalAverage = allScores.length ? Math.round((allScores.reduce((sum, value) => sum + value, 0) / allScores.length) * 10) / 10 : 0;
  const now = new Date();
  const commands = [
    "0.12 0.28 0.62 RG",
    pdfText("REPUBLIC OF THE PHILIPPINES", 215, 805, 8, false),
    pdfText(schoolName.toUpperCase(), Math.max(65, 298 - schoolName.length * 4.1), 784, 18, true),
    pdfText("LEARNER ACADEMIC REPORT CARD", 174, 760, 14, true),
    pdfLine(45, 746, 550, 746, 1.2),
    pdfText("Learner:", 50, 718, 9, true),
    pdfText(student?.name || "Student", 100, 718, 11, true),
    pdfText("Grade and Section:", 335, 718, 9, true),
    pdfText(`${student?.gradeLevel || student?.grade || ""} - ${student?.section || ""}`, 430, 718, 10, false),
    pdfText("School Year:", 50, 696, 9, true),
    pdfText(schoolYear || selected[0]?.schoolYear || "Current", 116, 696, 10, false),
    pdfText("Generated:", 335, 696, 9, true),
    pdfText(now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }), 395, 696, 9, false),
  ];

  const left = 50;
  const right = 545;
  const top = 660;
  const rowHeight = 30;
  const columns = [50, 250, 305, 360, 415, 470, 545];
  commands.push("0.25 0.32 0.42 RG");
  commands.push(pdfLine(left, top, right, top, 1));
  commands.push(pdfLine(left, top - rowHeight, right, top - rowHeight, 1));
  columns.forEach((x) => commands.push(pdfLine(x, top, x, top - rowHeight * (subjects.length + 2), 0.6)));
  commands.push(pdfText("LEARNING AREA", 104, top - 19, 9, true));
  commands.push(pdfText("1ST", 266, top - 19, 9, true));
  commands.push(pdfText("2ND", 321, top - 19, 9, true));
  commands.push(pdfText("3RD", 376, top - 19, 9, true));
  commands.push(pdfText("4TH", 431, top - 19, 9, true));
  commands.push(pdfText("FINAL", 488, top - 19, 9, true));

  subjects.forEach((subject, index) => {
    const yTop = top - rowHeight * (index + 1);
    const yText = yTop - 19;
    commands.push(pdfLine(left, yTop - rowHeight, right, yTop - rowHeight, 0.6));
    commands.push(pdfText(subject.slice(0, 31), 58, yText, 9, false));
    [1, 2, 3, 4].forEach((period, periodIndex) => {
      const score = scoreMap[`${subject}|${period}`];
      commands.push(pdfText(Number.isFinite(score) ? score : "-", 272 + periodIndex * 55, yText, 10, Number(score) >= 90));
    });
    commands.push(pdfText(rowAverages[subject] ?? "-", 494, yText, 10, true));
  });

  const averageTop = top - rowHeight * (subjects.length + 1);
  commands.push(pdfLine(left, averageTop - rowHeight, right, averageTop - rowHeight, 1));
  commands.push(pdfText("GENERAL AVERAGE", 58, averageTop - 19, 10, true));
  commands.push(pdfText(generalAverage, 494, averageTop - 19, 11, true));

  const remarksY = averageTop - 70;
  const finalRemark = generalAverage >= 90 ? "Outstanding" : generalAverage >= 85 ? "Very Satisfactory" : generalAverage >= 80 ? "Satisfactory" : generalAverage >= 75 ? "Fairly Satisfactory" : "Did Not Meet Expectations";
  commands.push(pdfText("ACADEMIC REMARKS", 50, remarksY, 10, true));
  commands.push(pdfLine(50, remarksY - 8, 545, remarksY - 8, 0.8));
  commands.push(pdfText(`General performance: ${finalRemark}.`, 58, remarksY - 31, 10, false));
  commands.push(pdfText("This report contains teacher-released records stored in the Jidanao Learning Management System.", 58, remarksY - 51, 8, false));

  commands.push(pdfLine(65, 112, 235, 112, 0.8));
  commands.push(pdfLine(360, 112, 530, 112, 0.8));
  commands.push(pdfText("Class Adviser / Teacher", 100, 96, 9, true));
  commands.push(pdfText("Parent / Guardian", 402, 96, 9, true));
  commands.push(pdfText("Official electronic copy - verify against school records when required.", 145, 54, 8, false));

  const filename = `Jidanao-Report-Card-${String(student?.name || "Student").replace(/[^a-z0-9]+/gi, "-")}-${schoolYear || "Current"}.pdf`;
  downloadPortraitPdf(commands.join("\n"), filename);
}
