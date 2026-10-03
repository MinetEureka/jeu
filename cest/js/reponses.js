// "01" のような素のキーは使いません。
// 01a / 01b / 01c / 01d の4つだけを回答判定に使います。

const maxVerbe = 12;

window.responses = Object.freeze({
  "01a": "c'est un stylo",
  "01b": "ce n'est pas un stylo",
  "01c": "ce sont des stylos",
  "01d": "ce ne sont pas des stylos",

  "02a": "c'est un sac",
  "02b": "ce n'est pas un sac",
  "02c": "ce sont des sacs",
  "02d": "ce ne sont pas des sacs",

  "03a": "c'est une gomme",
  "03b": "ce n'est pas une gomme",
  "03c": "ce sont des gommes",
  "03d": "ce ne sont pas des gommes",

  "04a": "c'est une clé",
  "04b": "ce n'est pas une clé",
  "04c": "ce sont des clés",
  "04d": "ce ne sont pas des clés",

  "05a": "c'est un téléphone",
  "05b": "ce n'est pas un téléphone",
  "05c": "ce sont des téléphones",
  "05d": "ce ne sont pas des téléphones",

  "06a": "c'est une université",
  "06b": "ce n'est pas une université",
  "06c": "ce sont des universités",
  "06d": "ce ne sont pas des universités",

  "07a": "c'est un chanteur",
  "07b": "ce n'est pas un chanteur",
  "07c": "ce sont des chanteurs",
  "07d": "ce ne sont pas des chanteurs",

  "08a": "c'est une employée",
  "08b": "ce n'est pas une employée",
  "08c": "ce sont des employées",
  "08d": ["ce ne sont pas des employées", "ce ne sont pas des employés"],

  "09a": "c'est un cahier",
  "09b": "ce n'est pas un cahier",
  "09c": "ce sont des cahiers",
  "09d": "ce ne sont pas des cahiers",

  "10a": "c'est un livre",
  "10b": "ce n'est pas un livre",
  "10c": "ce sont des livres",
  "10d": "ce ne sont pas des livres",

  "11a": "c'est un crayon",
  "11b": "ce n'est pas un crayon",
  "11c": "ce sont des crayons",
  "11d": "ce ne sont pas des crayons",

  "12a": "c'est une trousse",
  "12b": "ce n'est pas une trousse",
  "12c": "ce sont des trousses",
  "12d": "ce ne sont pas des trousses"

});