// ===== Web Audio: 状態管理の強化 =====
const maxVerbe = 26;
/* responses (外部化) */
window.responses = Object.freeze({
"01": "aller",                "01a": "je suis allé",           "01b": "je ne suis pas allé",
"02": "arriver",              "02a": "je suis arrivé",         "02b": "je ne suis pas arrivé",
"03": "avoir faim",           "03a": "j'ai eu",                "03b": "je n'ai pas eu",
"04": "avoir soif",           "04a": "j'ai eu",                "04b": "je n'ai pas eu",
"05": "avoir sommeil",        "05a": "j'ai eu",                "05b": "je n'ai pas eu",
"06": "dormir",               "06a": "j'ai dormi",             "06b": "je n'ai pas dormi",
"07": "écrire",               "07a": "j'ai écrit",             "07b": "je n'ai pas écrit",
"08": "être en forme",        "08a": "j'ai été",               "08b": "je n'ai pas été",
"09": "être fatigué",         "09a": "j'ai été",               "09b": "je n'ai pas été",
"10": "être malade",          "10a": "j'ai été",               "10b": "je n'ai pas été",
"11": "faire du shopping",    "11a": "j'ai fait",              "11b": "je n'ai pas fait",
"12": "faire du sport",       "12a": "j'ai fait",              "12b": "je n'ai pas fait",
"13": "jouer",                "13a": "j'ai joué",              "13b": "je n'ai pas joué",
"14": "lire",                 "14a": "j'ai lu",                "14b": "je n'ai pas lu",
"15": "manger",               "15a": "j'ai mangé",             "15b": "je n'ai pas mangé",
"16": "parler",               "16a": "j'ai parlé",             "16b": "je n'ai pas parlé",
"17": "partir",               "17a": "je suis parti",          "17b": "je ne suis pas parti",
"18": "prendre le déjeuner",  "18a": "j'ai pris",              "18b": "je n'ai pas pris",
"19": "prendre le dîner",     "19a": "j'ai pris",              "19b": "je n'ai pas pris",
"20": "rester",               "20a": "je suis resté",          "20b": "je ne suis pas resté",
"21": "se coucher",           "21a": "je me suis couché",      "21b": "je ne me suis pas couché",
"22": "se lever",             "22a": "je me suis levé",        "22b": "je ne me suis pas levé",
"23": "sortir",               "23a": "je suis sorti",          "23b": "je ne suis pas sorti",
"24": "travailler",           "24a": "j'ai travaillé",         "24b": "je n'ai pas travaillé",
"25": "venir",                "25a": "je suis venu",           "25b": "je ne suis pas venu",
"26": "voir des amis",        "26a": "j'ai vu",                "26b": "je n'ai pas vu"
});