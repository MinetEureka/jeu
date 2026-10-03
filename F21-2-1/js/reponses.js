const maxVerbe = 19;
/* responses (外部化) */
window.responses = Object.freeze({
"01": "aimer",                 "01a": "j'aime",               "01b": "je n'aime pas",
"02": "aller (aux toilettes)", "02a": "je vais",              "02b": "je ne vais pas",
"03": "arriver",               "03a": "j'arrive",             "03b": "je n'arrive pas",
"04": "avoir (faim)",          "04a": "j'ai",                 "04b": "je n'ai pas",
"05": "avoir (soif)",          "05a": "j'ai",                 "05b": "je n'ai pas",
"06": "écouter",               "06a": "j'écoute",             "06b": "je n'écoute pas",
"07": "être (en forme)",       "07a": "je suis",              "07b": "je ne suis pas",
"08": "être (fatigué)",        "08a": "je suis",              "08b": "je ne suis pas",
"09": "faire (du shopping)",   "09a": "je fais",              "09b": "je ne fais pas",
"10": "faire (du sport)",      "10a": "je fais",              "10b": "je ne fais pas",
"11": "habiter",               "11a": "j'habite",             "11b": "je n'habite pas",
"12": "manger",                "12a": "je mange",             "12b": "je ne mange pas",
"13": "partir",                "13a": "je pars",              "13b": "je ne pars pas",
"14": "prendre (le train)",    "14a": "je prends",            "14b": "je ne prends pas",
"15": "prendre (un café)",     "15a": "je prends",            "15b": "je ne prends pas",
"16": "regarder (la télé)",    "16a": "je regarde",           "16b": "je ne regarde pas",
"17": "rentrer",               "17a": "je rentre",            "17b": "je ne rentre pas",
"18": "se lever",              "18a": "je me lève",           "18b": "je ne me lève pas",
"19": "travailler",            "19a": "je travaille",         "19b": "je ne travaille pas",
});
