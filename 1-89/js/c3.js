/* core calculator - depends on window.scoreKey and window.hexReplaceMap */
(function(){
  function computePassword(sidLast4, score){
    var a = window.scoreKey;
    if(a == null) throw new Error('scoreKey is missing');
    var key = parseInt(String(sidLast4).slice(-4), 10);
    if(isNaN(key)) throw new Error('sidLast4 must be numeric');
    var s = parseInt(score, 10);
    if(isNaN(s)) throw new Error('score must be numeric');
    var v = Math.pow(key + a, 2) + Math.pow(s + a, 2);
    var hex = v.toString(16).toUpperCase();
    var map = window.hexReplaceMap || {};
    return hex.split('').map(function(c){ return map[c] || c; }).join('');
  }
  window.computePassword = computePassword;
})();
