import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const outDir = path.resolve("docs", "\u5b9e\u9a8c\u6570\u636e");
fs.mkdirSync(outDir, { recursive: true });

const H = {
  question: "\u9898\u53f7",
  knowledge: "\u77e5\u8bc6\u70b9",
  score: "\u5206\u503c",
  ability: "\u80fd\u529b\u7ef4\u5ea6",
  difficulty: "\u96be\u5ea6",
  className: "\u73ed\u7ea7",
  studentCode: "\u5b66\u53f7",
  studentName: "\u59d3\u540d",
  phone: "\u5bb6\u957f\u8054\u7cfb\u7535\u8bdd",
  teacherComment: "\u73ed\u4e3b\u4efb\u8bc4\u8bed",
  morality: "\u5fb7\u80b2\u89c2\u5bdf",
  remark: "\u5907\u6ce8",
  status: "\u72b6\u6001",
  absent: "\u7f3a\u8003\u8bf4\u660e",
  inputTime: "\u5f55\u5165\u65f6\u95f4",
  total: "\u603b\u5206",
  average: "\u5e73\u5747\u5206",
  invalid: "\u65e0\u6548\u9879\u76ee",
};

const blueprint = [
  ["1", "\u96c6\u5408\u4e0e\u5e38\u7528\u903b\u8f91\u7528\u8bed", 4, "\u57fa\u7840\u7406\u89e3", "\u6613"],
  ["2", "\u5145\u5206\u6761\u4ef6\u4e0e\u5fc5\u8981\u6761\u4ef6", 4, "\u63a8\u7406\u5224\u65ad", "\u4e2d"],
  ["3", "\u4e00\u5143\u4e8c\u6b21\u4e0d\u7b49\u5f0f", 5, "\u8fd0\u7b97\u6c42\u89e3", "\u4e2d"],
  ["4.1", "\u51fd\u6570\u5355\u8c03\u6027", 6, "\u56fe\u50cf\u5206\u6790", "\u4e2d"],
  ["4.2", "\u51fd\u6570\u6700\u503c", 6, "\u7efc\u5408\u5e94\u7528", "\u96be"],
  ["5", "\u4e09\u89d2\u51fd\u6570\u57fa\u672c\u5173\u7cfb", 5, "\u8fd0\u7b97\u6c42\u89e3", "\u4e2d"],
  ["6", "\u5411\u91cf\u6570\u91cf\u79ef", 5, "\u8fd0\u7b97\u6c42\u89e3", "\u4e2d"],
  ["7", "\u89e3\u6790\u51e0\u4f55\u76f4\u7ebf\u65b9\u7a0b", 6, "\u5efa\u6a21\u5e94\u7528", "\u96be"],
  ["8", "\u6982\u7387\u53e4\u5178\u6982\u578b", 4, "\u6982\u7387\u63a8\u65ad", "\u6613"],
  ["9", "\u7edf\u8ba1\u56fe\u8868\u89e3\u8bfb", 5, "\u6570\u636e\u5206\u6790", "\u4e2d"],
  ["10", "\u5bfc\u6570\u4e0e\u5207\u7ebf", 6, "\u7efc\u5408\u5e94\u7528", "\u96be"],
  ["11", "\u6570\u5217\u901a\u9879\u4e0e\u524dn\u9879\u548c", 6, "\u63a8\u7406\u63a2\u7a76", "\u96be"],
].map(([question, knowledge, score, ability, difficulty]) => ({
  [H.question]: question,
  [H.knowledge]: knowledge,
  [H.score]: score,
  [H.ability]: ability,
  [H.difficulty]: difficulty,
}));

const surnameList = [
  "\u5f20", "\u738b", "\u674e", "\u8d75", "\u5218", "\u9648", "\u6768", "\u9ec4", "\u5468", "\u5434",
  "\u5f90", "\u5b59", "\u80e1", "\u6731", "\u9ad8", "\u6797", "\u4f55", "\u90ed", "\u9a6c", "\u7f57",
];

const givenList = [
  "\u5b50\u6db5", "\u6893\u8f69", "\u96e8\u6850", "\u5b87\u8fb0", "\u6c90\u9633", "\u4f73\u5b81", "\u53ef\u6b23", "\u601d\u8fdc",
  "\u4fca\u6770", "\u6b23\u6021", "\u4e66\u7476", "\u6668\u66e6", "\u82e5\u6db5", "\u94ed\u6cfd", "\u6021\u7136", "\u535a\u6587",
  "\u661f\u5b87", "\u5609\u5b81", "\u5955\u8fb0", "\u5b89\u742a", "\u6d69\u7136", "\u666f\u884c", "\u4f9d\u8bfa", "\u7693\u8f69",
  "\u9759\u6021", "\u4e00\u9e23", "\u829d\u6674", "\u5609\u8c6a", "\u5fc3\u598d", "\u8bed\u5f64",
];

const classConfigs = [
  {
    className: "\u9ad8\u4e001\u73ed",
    baseRate: 0.82,
    weakness: { "4.2": -0.22, "10": -0.18, "11": -0.08 },
    strength: { "1": 0.08, "5": 0.05, "8": 0.06 },
  },
  {
    className: "\u9ad8\u4e002\u73ed",
    baseRate: 0.73,
    weakness: { "3": -0.16, "7": -0.18, "10": -0.14 },
    strength: { "1": 0.05, "8": 0.04 },
  },
  {
    className: "\u9ad8\u4e003\u73ed",
    baseRate: 0.68,
    weakness: { "2": -0.14, "4.1": -0.12, "4.2": -0.2, "11": -0.16 },
    strength: { "8": 0.03, "9": 0.02 },
  },
  {
    className: "\u9ad8\u4e004\u73ed",
    baseRate: 0.77,
    weakness: { "6": -0.12, "7": -0.16, "10": -0.1 },
    strength: { "1": 0.07, "3": 0.04, "5": 0.03 },
  },
];

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeStudentName(index, classIndex) {
  return `${surnameList[(index + classIndex * 3) % surnameList.length]}${givenList[(index * 2 + classIndex) % givenList.length]}`;
}

function buildClassRows(config, classIndex) {
  const rows = [];
  const random = seededRandom(20260318 + classIndex * 97);

  for (let i = 0; i < 24; i += 1) {
    const studentCode = `2026${String(classIndex + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`;
    const studentName = makeStudentName(i, classIndex);
    const abilityShift = (random() - 0.45) * 0.22;
    const row = {
      [H.className]: config.className,
      [H.studentCode]: studentCode,
      [H.studentName]: studentName,
      [H.phone]: `138${String(10000000 + classIndex * 240 + i).slice(-8)}`,
      [H.teacherComment]:
        i % 7 === 0
          ? "\u9700\u5173\u6ce8\u8ba1\u7b97\u7ec6\u8282"
          : i % 5 === 0
            ? "\u8bfe\u5802\u72b6\u6001\u7a33\u5b9a"
            : "\u5b9e\u9a8c\u6837\u4f8b\u6570\u636e",
      [H.morality]: i % 6 === 0 ? "\u6b63\u5e38" : "\u65e0",
      [H.remark]: i % 8 === 0 ? "\u542b\u65e0\u6548\u9879\u6d4b\u8bd5" : "",
      [H.status]: i === 5 ? "\u8865\u6d4b" : "\u6709\u6548",
      [H.absent]: i === 10 ? "\u7b2c10\u9898\u7f3a\u8003" : "",
      [H.inputTime]: `2026-03-${String((i % 9) + 1).padStart(2, "0")}`,
    };

    let total = 0;

    blueprint.forEach((item, qIndex) => {
      const questionKey = item[H.question];
      const fullScore = item[H.score];
      const questionRateBase =
        config.baseRate + (config.weakness[questionKey] || 0) + (config.strength[questionKey] || 0);
      const questionNoise = (random() - 0.5) * 0.18;
      let rate = clamp(questionRateBase + abilityShift + questionNoise, 0.1, 1);
      let score = Math.round(fullScore * rate);
      score = clamp(score, 0, fullScore);

      const scoreHeader = `Q${questionKey}\u5f97\u5206`;
      if ((i === 2 && questionKey === "4.2") || (i === 9 && questionKey === "10")) {
        row[scoreHeader] = qIndex % 2 === 0 ? "" : "\u7f3a\u8003";
      } else if (i === 15 && questionKey === "7") {
        row[scoreHeader] = "\u5f85\u5f55\u5165";
      } else {
        row[scoreHeader] = score;
        total += score;
      }
    });

    row[H.total] = total;
    row[H.average] = Number((total / blueprint.length).toFixed(2));
    row[H.invalid] = i % 4 === 0 ? "\u4ec5\u7528\u4e8e\u6d4b\u8bd5\u89e3\u6790\u5ffd\u7565\u6548\u679c" : "";
    rows.push(row);
  }

  return rows;
}

function writeWorkbook(filePath, sheetName, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
}

writeWorkbook(
  path.join(outDir, "\u9ad8\u4e00\u6570\u5b66-\u53cc\u5411\u7ec6\u76ee\u8868.xlsx"),
  "\u53cc\u5411\u7ec6\u76ee\u8868",
  blueprint
);

classConfigs.forEach((config, index) => {
  writeWorkbook(
    path.join(outDir, `${config.className}-\u6570\u5b66-\u5c0f\u9898\u7ec6\u5206\u6570\u636e.xlsx`),
    `${config.className}\u6570\u636e`,
    buildClassRows(config, index)
  );
});

console.log(`Generated files in ${outDir}`);
