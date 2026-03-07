// データ定義ファイル：contenu.js（Chapitre 2〜8 の雛形込み）
// キー規約：
//  - "NN"                  : rubrique 見出し
//  - "NN-n[a-d]"           : n番目カード（a=見出し, b=補足, c=ボタンラベル, d=URL）
//  - 改行を入れたい場所     : a に "__BREAK__" を入れる（b/c/d は不要）

const CONTENU = {
  // ===== Rubrique 01: アルファベ・数字 =====
  "01": "アルファベ・数字",

  // 1行目: Alphabet（同幅・先頭に単独で配置）
  "01-1a": "Alphabet",
  "01-1b": "ID: 01a_alphabet",
  "01-1c": "Alphabet",
  "01-1d": "https://example.edu/01a_alphabet/index.html",

  // 改行（Alphabet の次で行を変える）
  "01-2a": "__BREAK__",

  // 数字レンジ（必要に応じてURLを実運用に差し替えてください）
  "01-4a": "1-10",   "01-4b": "ID: 01b_1-10",   "01-4c": "1-10",   "01-4d": "https://example.edu/01b_1-10/",
  "01-5a": "1-20",   "01-5b": "ID: 01b_1-20",   "01-5c": "1-20",   "01-5d": "https://example.edu/01b_1-20/",
  "01-6a": "1-39",   "01-6b": "ID: 01b_1-39",   "01-6c": "1-39",   "01-6d": "https://example.edu/01b_1-39/",
  "01-7a": "1-49",   "01-7b": "ID: 01b_1-49",   "01-7c": "1-49",   "01-7d": "https://example.edu/01b_1-49/",
  "01-8a": "1-59",   "01-8b": "ID: 01b_1-59",   "01-8c": "1-59",   "01-8d": "https://example.edu/01b_1-59/",
  "01-9a": "1-69",   "01-9b": "ID: 01b_1-69",   "01-9c": "1-69",   "01-9d": "https://example.edu/01b_1-69/",
  "01-10a": "1-79",  "01-10b": "ID: 01b_1-79",  "01-10c": "1-79",  "01-10d": "https://example.edu/01b_1-79/",
  "01-11a": "1-89",  "01-11b": "ID: 01b_1-89",  "01-11c": "1-89",  "01-11d": "https://example.edu/01b_1-89/",
  "01-12a": "1-100", "01-12b": "ID: 01b_1-100", "01-12c": "1-100", "01-12d": "https://example.edu/01b_1-100/",

  // ===== Rubrique 02: 動詞カルタ（Chapitre 2） =====
  "02": "動詞カルタ",
  // Chapitre 2（Leçon 04–06）
  "02-1a": "Chapitre 2（Leçon 04–06）", "02-1b": "être + 第一群規則動詞", "02-1c": "Leçon 04", "02-1d": "https://example.edu/verbes/lecon04.html",
  "02-2a": "Leçon 05",                    "02-2b": "補足可",                 "02-2c": "Leçon 05", "02-2d": "https://example.edu/verbes/lecon05.html",
  "02-3a": "Leçon 06",                    "02-3b": "補足可",                 "02-3c": "Leçon 06", "02-3d": "https://example.edu/verbes/lecon06.html",

  // ===== Chapitre 3（Leçon 07–09） =====
  "02-4a": "Chapitre 3（Leçon 07–09）", "02-4b": "avoir + 第一群規則動詞",  "02-4c": "Leçon 07", "02-4d": "https://example.edu/verbes/lecon07.html",
  "02-5a": "Leçon 08",                    "02-5b": "補足可",                 "02-5c": "Leçon 08", "02-5d": "https://example.edu/verbes/lecon08.html",
  "02-6a": "Leçon 09",                    "02-6b": "補足可",                 "02-6c": "Leçon 09", "02-6d": "https://example.edu/verbes/lecon09.html",

  // ===== Chapitre 4（Leçon 10–12） =====
  "02-7a":  "Chapitre 4（Leçon 10–12）", "02-7b":  "avoir / être + 第一群",   "02-7c":  "Leçon 10", "02-7d":  "https://example.edu/verbes/lecon10.html",
  "02-8a":  "Leçon 11",                   "02-8b":  "補足可",                 "02-8c":  "Leçon 11", "02-8d":  "https://example.edu/verbes/lecon11.html",
  "02-9a":  "Leçon 12",                   "02-9b":  "補足可",                 "02-9c":  "Leçon 12", "02-9d":  "https://example.edu/verbes/lecon12.html",

  // ===== Chapitre 5（Leçon 13–15） =====
  "02-10a": "Chapitre 5（Leçon 13–15）", "02-10b": "aimer / boire など",      "02-10c": "Leçon 13", "02-10d": "https://example.edu/verbes/lecon13.html",
  "02-11a": "Leçon 14",                   "02-11b": "補足可",                 "02-11c": "Leçon 14", "02-11d": "https://example.edu/verbes/lecon14.html",
  "02-12a": "Leçon 15",                   "02-12b": "補足可",                 "02-12c": "Leçon 15", "02-12d": "https://example.edu/verbes/lecon15.html",

  // ===== Chapitre 6（Leçon 16–18） =====
  "02-13a": "Chapitre 6（Leçon 16–18）", "02-13b": "regarder / écouter",      "02-13c": "Leçon 16", "02-13d": "https://example.edu/verbes/lecon16.html",
  "02-14a": "Leçon 17",                   "02-14b": "補足可",                 "02-14c": "Leçon 17", "02-14d": "https://example.edu/verbes/lecon17.html",
  "02-15a": "Leçon 18",                   "02-15b": "補足可",                 "02-15c": "Leçon 18", "02-15d": "https://example.edu/verbes/lecon18.html",

  // ===== Chapitre 7（Leçon 19–21） =====
  "02-16a": "Chapitre 7（Leçon 19–21）", "02-16b": "voir / sortir",          "02-16c": "Leçon 19", "02-16d": "https://example.edu/verbes/lecon19.html",
  "02-17a": "Leçon 20",                   "02-17b": "補足可",                 "02-17c": "Leçon 20", "02-17d": "https://example.edu/verbes/lecon20.html",
  "02-18a": "Leçon 21",                   "02-18b": "補足可",                 "02-18c": "Leçon 21", "02-18d": "https://example.edu/verbes/lecon21.html",

  // ===== Chapitre 8（Leçon 22–24） =====
  "02-19a": "Chapitre 8（Leçon 22–24）", "02-19b": "faire / aller / venir",  "02-19c": "Leçon 22", "02-19d": "https://example.edu/verbes/lecon22.html",
  "02-20a": "Leçon 23",                   "02-20b": "補足可",                 "02-20c": "Leçon 23", "02-20d": "https://example.edu/verbes/lecon23.html",
  "02-21a": "Leçon 24",                   "02-21b": "補足可",                 "02-21c": "Leçon 24", "02-21d": "https://example.edu/verbes/lecon24.html"
};
