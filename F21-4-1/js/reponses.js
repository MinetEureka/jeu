// ===== Web Audio: 状態管理の強化 =====
const maxVerbe = 15;
/* responses (外部化) */
window.responses = Object.freeze({
"01": "aimer",                 "01a": "j'aimais",                "01b": "je n'aimais pas",
"02": "aller",                 "02a": "j'allais",                "02b": "je n'allais pas",
"03": "avoir (chaud)",         "03a": "j'avais",                 "03b": "je n'avais pas",
"04": "avoir (froid)",         "04a": "j'avais",                 "04b": "je n'avais pas",
"05": "avoir (mal)",           "05a": "j'avais",                 "05b": "je n'avais pas",
"06": "être (en forme)",       "06a": "j'étais",                 "06b": "je n'étais pas",
"07": "être (fatigué)",        "07a": "j'étais",                 "07b": "je n'étais pas",
"08": "être (malade)",         "08a": "j'étais",                 "08b": "je n'étais pas",
"09": "faire (du shopping)",   "09a": "je faisais",              "09b": "je ne faisais pas",
"10": "faire (du sport)",      "10a": "je faisais",              "10b": "je ne faisais pas",
"11": "lire",                  "11a": "je lisais",               "11b": "je ne lisais pas",
"12": "prendre (le train)",    "12a": "je prenais",              "12b": "je ne prenais pas",
"13": "prendre (un café)",     "13a": "je prenais",              "13b": "je ne prenais pas",
"14": "se coucher",            "14a": "je me couchais",          "14b": "je ne me couchais pas",
"15": "venir",                 "15a": "je venais",               "15b": "je ne venais pas"
});