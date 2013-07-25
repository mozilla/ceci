var fs = require('fs');

fs.readFile('ceci.js', 'utf8', function(err, jsData) {
  fs.readFile('components.html', 'utf8', function(err, htmlData) {
    var combinedData = '';

    combinedData += '(function(){\n';
    combinedData += 'var div = document.createElement("div");\n';
    combinedData += 'div.innerHTML = "' + htmlData.replace(/\n/g, '\\n')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"') + '";\n';

    combinedData += 'if (document.body) {document.body.appendChild(div);}\n';
    combinedData += 'else {document.addEventListener("readystatechange", function(e){document.body.appendChild(div);}, false);}\n';
    combinedData += '})();\n';

    combinedData += jsData;

    fs.writeFile('ceci-combo.js', combinedData);
  });
});