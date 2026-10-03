// ===== Web Audio: 状態管理の強化 =====
const maxVerbe = 26;
const nbrVerbe = 4;

/* responses (外部化) */
window.responses = Object.freeze({
"01": "aller", "01a": "je suis allé", "01b": "je ne suis pas allé", "01c": "j'allais", "01d": "je n'allais pas",
"02": "arriver", "02a": "je suis arrivé", "02b": "je ne suis pas arrivé", "02c": "j'arrivais", "02d": "je n'arrivais pas",
"03": "avoir faim", "03a": "j'ai eu", "03b": "je n'ai pas eu", "03c": "j'avais", "03d": "je n'avais pas",
"04": "avoir soif", "04a": "j'ai eu", "04b": "je n'ai pas eu", "04c": "j'avais", "04d": "je n'avais pas",
"05": "avoir sommeil", "05a": "j'ai eu", "05b": "je n'ai pas eu", "05c": "j'avais", "05d": "je n'avais pas",
"06": "dormir", "06a": "j'ai dormi", "06b": "je n'ai pas dormi", "06c": "je dormais", "06d": "je ne dormais pas",
"07": "écrire", "07a": "j'ai écrit", "07b": "je n'ai pas écrit", "07c": "j'écrivais", "07d": "je n'écrivais pas",
"08": "être en forme", "08a": "j'ai été", "08b": "je n'ai pas été", "08c": "j'étais", "08d": "je n'étais pas",
"09": "être fatigué", "09a": "j'ai été", "09b": "je n'ai pas été", "09c": "j'étais", "09d": "je n'étais pas",
"10": "être malade", "10a": "j'ai été", "10b": "je n'ai pas été", "10c": "j'étais", "10d": "je n'étais pas",
"11": "faire du shopping", "11a": "j'ai fait", "11b": "je n'ai pas fait", "11c": "je faisais", "11d": "je ne faisais pas",
"12": "faire du sport", "12a": "j'ai fait", "12b": "je n'ai pas fait", "12c": "je faisais", "12d": "je ne faisais pas",
"13": "jouer", "13a": "j'ai joué", "13b": "je n'ai pas joué", "13c": "je jouais", "13d": "je ne jouais pas",
"14": "lire", "14a": "j'ai lu", "14b": "je n'ai pas lu", "14c": "je lisais", "14d": "je ne lisais pas",
"15": "manger", "15a": "j'ai mangé", "15b": "je n'ai pas mangé", "15c": "je mangeais", "15d": "je ne mangeais pas",
"16": "parler", "16a": "j'ai parlé", "16b": "je n'ai pas parlé", "16c": "je parlais", "16d": "je ne parlais pas",
"17": "partir", "17a": "je suis parti", "17b": "je ne suis pas parti", "17c": "je partais", "17d": "je ne partais pas",
"18": "prendre le déjeuner", "18a": "j'ai pris", "18b": "je n'ai pas pris", "18c": "je prenais", "18d": "je ne prenais pas",
"19": "prendre le dîner", "19a": "j'ai pris", "19b": "je n'ai pas pris", "19c": "je prenais", "19d": "je ne prenais pas",
"20": "rester", "20a": "je suis resté", "20b": "je ne suis pas resté", "20c": "je restais", "20d": "je ne restais pas",
"21": "se coucher", "21a": "je me suis couché", "21b": "je ne me suis pas couché", "21c": "je me couchais", "21d": "je ne me couchais pas",
"22": "se lever", "22a": "je me suis levé", "22b": "je ne me suis pas levé", "22c": "je me levais", "22d": "je ne me levais pas",
"23": "sortir", "23a": "je suis sorti", "23b": "je ne suis pas sorti", "23c": "je sortais", "23d": "je ne sortais pas",
"24": "travailler", "24a": "j'ai travaillé", "24b": "je n'ai pas travaillé", "24c": "je travaillais", "24d": "je ne travaillais pas",
"25": "venir", "25a": "je suis venu", "25b": "je ne suis pas venu", "25c": "je venais", "25d": "je ne venais pas",
"26": "voir des amis", "26a": "j'ai vu", "26b": "je n'ai pas vu", "26c": "je voyais", "26d": "je ne voyais pas"
});