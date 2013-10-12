define(function() {
  function sendRequest(url, callback, postData) {
    var req = createXMLHTTPObject();

    if (!req) return;

    var method = (postData) ? "POST" : "GET";
    req.open(method, url, true);

    if (postData){
      req.setRequestHeader('Content-type','application/x-www-form-urlencoded');
    }

    req.onreadystatechange = function() {
      if (req.readyState != 4) return;

      if (req.status != 200 && req.status != 304) {
        return;
      }
      callback(req.response);
    };

    if (req.readyState == 4) return;

    req.send(postData);
  }

  var XMLHttpFactories = [
    function() { return new XMLHttpRequest(); },
    function() { return new ActiveXObject("Msxml2.XMLHTTP"); },
    function() { return new ActiveXObject("Msxml3.XMLHTTP"); },
    function() { return new ActiveXObject("Microsoft.XMLHTTP"); }
  ];

  function createXMLHTTPObject() {
    var xmlhttp = false;
    for (var i=0; i<XMLHttpFactories.length; i++) {
      try {
        xmlhttp = XMLHttpFactories[i]();
      }
      catch(e) {
        continue;
      }

      break;
    }
    return xmlhttp;
  }

  return {
    get: sendRequest,
    post: sendRequest
  };
});
