(function(){
  function computePassword(sidLast4, score){
    var a = Number(window.scoreKey);
    if (window.scoreKey == null || !Number.isSafeInteger(a)) throw new Error('scoreKey must be an integer');
    if (!/^\d{4}$/.test(String(sidLast4))) throw new Error('sidLast4 must be four digits');
    if (!Number.isInteger(score) || score < 0) throw new Error('score must be a nonnegative integer');
    var key = parseInt(String(sidLast4).slice(-4), 10);
    if(isNaN(key)) throw new Error('sidLast4 must be numeric');
    var s = parseInt(score, 10);
    if(isNaN(s)) throw new Error('score must be numeric');
    var v = Math.pow(key + a, 2) + Math.pow(s + a, 2);
    if (!Number.isSafeInteger(v)) throw new Error('Password exceeds integer precision');
    var hex = v.toString(16).toUpperCase();
    var map = window.hexReplaceMap;
    if (!map || !'0123456789ABCDEF'.split('').every(c => typeof map[c] === 'string' && map[c].length > 0)) throw new Error('hexReplaceMap is missing or incomplete');
    return hex.split('').map(function(c){ return map[c] || c; }).join('');
  }
  window.computePassword = computePassword;
})();
