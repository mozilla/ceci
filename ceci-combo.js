(function(){
var div = document.createElement("div");
div.innerHTML = "<element name=\"app-block\">\n  <template>\n    <div>Default Text</div>\n  </template>\n  <script type=\"text/ceci\">\n    Ceci(this, {\n      init: function () {\n      },\n      editable: {\n        text: function (val) {\n          this.querySelector(\'div\').innerHTML = val;\n          this.emit(\'text\', val);\n        }\n      }\n    });\n  </script>\n</element>\n\n<element name=\"app-value-thinger\">\n  <template>\n    <input type=\"text\"><button>Submit</button>\n  </template>\n  <script type=\"text/ceci\">\n    Ceci(this, {\n      init: function () {\n        var that = this;\n        this.querySelector(\'button\').onclick = function (e) {\n          that.emit(\'value\', that.querySelector(\'input[type=\"text\"]\').value);\n        };\n      },\n      editable: {\n        value: function (val) {\n          this.querySelector(\'input[type=\"text\"]\').value = val;\n        }\n      }\n    });\n  </script>\n</element>\n\n\n<element name=\"app-timer\">\n  <script type=\"text/ceci\">\n    Ceci(this, {\n      init: function() {\n        this.period = 1000;\n        this.count = 0;\n        this.tick();\n      },\n      tick: function() {\n        this.count++;\n        this.emit(\'ding\', this.count);\n\n        var t = this;\n        var defer = function(){\n          t.tick();\n        };\n        setTimeout(defer, this.period);\n      },\n      editable: {\n        period: function (val) {\n          // errors?\n          val = parseInt(val);\n          this.setAttribute(\'period\', val);\n          this.emit(\'period\', val);\n        }\n      }\n    });\n  </script>\n</element>";
if (document.body) {document.body.appendChild(div);}
else {document.addEventListener("readystatechange", function(e){document.body.appendChild(div);}, false);}
})();
(function(){
  
window['\u00E7'.toUpperCase()] = window.Ceci = function (element, def) {

  function parseAvastElement (avastElement) {
    var toElement = document.querySelector(avastElement.getAttribute('to'));
    var myType = avastElement.getAttribute('my');
    var beType = avastElement.getAttribute('be');
    if (toElement) {
      element.addEventListener('app-' + myType, function (e) {
        toElement[beType] = e.data || e.detail;
      }, false);
    }
  }

  var reserved = ['init', 'editable'];

  Object.keys(def).filter(function (item) { return reserved.indexOf(item) === -1; }).forEach(function (key) {
    var entry = def[key];
    if (typeof entry === 'function') {
      element[key] = entry;
    }
  });
  
  Object.keys(def.editable).forEach(function (key) {
    var entry = def.editable[key];
    var entryType = typeof entry;
    var scopedEntry = '_' + key;

    if (entryType === 'function') {
      Object.defineProperty(element, key, {
        set: function (val) {
          element[scopedEntry] = val;
          entry.call(element, val);
        },
        get: function () {
          return element[scopedEntry];
        }
      });
    }
    else if (entryType === 'object') {
      Object.defineProperty(element, key, {
        set: entry.set,
        get: entry.get
      });
    }
  });

  element.emit = function (type, data) {
    var customEvent = document.createEvent('CustomEvent');
    customEvent.initCustomEvent('app-' + type, false, false, data);
    element.dispatchEvent(customEvent);
  };

  element.avast = function (to, my, be) {
    var avastElement = document.createElement('avast');
    avastElement.setAttribute('to', to);
    avastElement.setAttribute('my', my);
    avastElement.setAttribute('be', be);
    parseAvastElement(avastElement);
  };

  element.init = function() {
    if (def.init) {
      def.init.call(element);
    }
  };
};

Ceci._components = {};

Ceci.faire = function (element) {
  var def = Ceci._components[element.localName];

  var avastElements = element.querySelectorAll('avast');

  element._innerHTML = element.innerHTML;

  if (def.template){
    element.innerHTML = def.template.innerHTML;
  }

  def.contructor.call(element);

  Array.prototype.forEach.call(avastElements, function (avastElement) {
    element.avast( avastElement.getAttribute('to'),
                           avastElement.getAttribute('my'),
                           avastElement.getAttribute('be'));
  });

  element.init();
};

Ceci.avoir = function (element) {
  var name = element.getAttribute('name');
  var template = element.querySelector('template');
  var script = element.querySelector('script[type="text/ceci"]');
  var contructor = new Function(script.innerHTML);

  // [ window.HTMLElement.prototype,
  //   window.HTMLDivElement.prototype,
  //   window.DocumentFragment.prototype ].forEach(function (prototype) {
  //     prototype.__appendChild = prototype.appendChild;
  //     prototype.__insertBefore = prototype.insertBefore;
  //   });

  Ceci._components[name] = {
    template: template,
    contructor: contructor,
  };

  var existingElements = document.querySelectorAll(name);
  Array.prototype.forEach.call(existingElements, function (existingElement) {
    Ceci.faire(existingElement);
  });
};

Ceci.commencer = function () {
  function scrape () {
    Array.prototype.slice.call(document.querySelectorAll('element')).forEach(Ceci.avoir);
  }

  var ceciScripts = document.querySelectorAll('script[data-ceci-components]');

  if (ceciScripts.length) {
    var scriptsLeft = ceciScripts.length;
    Array.prototype.forEach.call(ceciScripts, function (ceciScript) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', ceciScript.getAttribute('data-ceci-components') ,true);
      xhr.onload = function (e) {
        var fragment = document.createElement('div');
        fragment.innerHTML = xhr.response;
        if (document.body.firstChild) {
          document.body.insertBefore(fragment, document.body.firstChild);
        }
        else {
          document.body.appendChild(fragment); 
        }
        if (--scriptsLeft === 0) {
          scrape();
        }
      };
      xhr.send(null);
    });
  }
  else {
    scrape();
  }
};

document.addEventListener('DOMContentLoaded', function (e) {
  Ceci.commencer();
}, false);

})();