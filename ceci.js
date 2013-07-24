(function(){
  
window['\u00E7'.toUpperCase()] = window.Ceci = function (element, def) {

  function parseListenElement (listenElement) {
    var toElement = document.querySelector(listenElement.getAttribute('to'));
    var onType = listenElement.getAttribute('on');
    var sendType = listenElement.getAttribute('send');
    if (toElement) {
      toElement.addEventListener('app-' + onType, function (e) {
        element[sendType] = e.data || e.detail;
      }, false);
    }
  }
  
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

    element.listen = function (to, on, send) {
      var listenElement = document.createElement('listen');
      listenElement.setAttribute('to', to);
      listenElement.setAttribute('on', on);
      listenElement.setAttribute('send', send);
      parseListenElement(listenElement);
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
    var listenElements = existingElement.querySelectorAll('listen');

    existingElement._innerHTML = existingElement.innerHTML;
    existingElement.innerHTML = template.innerHTML;

    func.call(existingElement);

    Array.prototype.forEach.call(listenElements, function (listenElement) {
      existingElement.listen( listenElement.getAttribute('to'),
                              listenElement.getAttribute('on'),
                              listenElement.getAttribute('send'));
    });

    existingElement.init && existingElement.init();
  });
};

// Register all <element> tags with Ceçi
document.addEventListener('DOMContentLoaded', function (e) {
  Array.prototype.slice.call(document.querySelectorAll('element')).forEach(Ceci.register);
}, false);

})();