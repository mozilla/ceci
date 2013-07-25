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
      def.init.call(element);
    }
  });
};

Ceci.register = function (element) {
  var template = element.querySelector('template');
  var script = element.querySelector('script[type="text/ceci"]');
  var func = new Function(script.innerHTML);

  // [ window.HTMLElement.prototype,
  //   window.HTMLDivElement.prototype,
  //   window.DocumentFragment.prototype ].forEach(function (prototype) {
  //     prototype.__appendChild = prototype.appendChild;
  //     prototype.__insertBefore = prototype.insertBefore;
  //   });

  var existingElements = document.querySelectorAll(element.getAttribute('name'));
  Array.prototype.forEach.call(existingElements, function (existingElement) {
    var broadcastElements = existingElement.querySelectorAll('avast');

    existingElement._innerHTML = existingElement.innerHTML;

    if (template){
      existingElement.innerHTML = template.innerHTML;
    }

    func.call(existingElement);

    Array.prototype.forEach.call(broadcastElements, function (broadcastElement) {
      existingElement.avast( broadcastElement.getAttribute('to'),
                             broadcastElement.getAttribute('my'),
                             broadcastElement.getAttribute('be'));
    });

    existingElement.init && existingElement.init();
  });
};

// Register all <element> tags with Ceçi
document.addEventListener('DOMContentLoaded', function (e) {
  Array.prototype.slice.call(document.querySelectorAll('element')).forEach(Ceci.register);
}, false);

})();