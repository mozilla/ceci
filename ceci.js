define(function() {

  var getChannel = function(name) {
    return "flathead:" + name;
  }

  var Ceci = function (element, def) {

    var reserved = ['init', 'editable'];

    Object.keys(def).filter(function (item) {
      return reserved.indexOf(item) === -1;
    }).forEach(function (key) {
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
            element[scopedEntry] = val.data;
            entry.call(element, val.data, val.channel);
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

    element.emit = function (data) {
      element.channels.out.forEach(function(channel) {
        var customEvent = document.createEvent('CustomEvent');
        customEvent.initCustomEvent(getChannel(channel), {bubbles: true});
        customEvent.data = data;
        element.dispatchEvent(customEvent);
        console.log(element.id + " -> " + channel);
      });
    };

    element.init = function() {
      if (def.init) {
        def.init.call(element);
      }
    };
  }

  Ceci.reserved = ['init', 'editable'];

  Ceci._components = {};

  function getChannelsByType(element, type) {
    var channels = element.getElementsByTagName(type);
    channels = Array.prototype.slice.call(channels);
    if(channels.length===0) {
      return false;
    }
    channels = channels.map(function(channel) {
      return channel.getAttribute("channel");
    });
    return channels;
  };

  function getChannels(element) {
    var inchan = getChannelsByType(element, "input"),
        outchan = getChannelsByType(element, "output");
    if(!inchan && !outchan) {
      return {
        in: ["blue"],
        out: ["blue"]
      };
    }
    return {
      in: inchan || [],
      out: outchan || []
    };
  };

  Ceci.convertElement = function (element) {
    var def = Ceci._components[element.localName];
    // data channels this element needs to hook into
    element.channels = getChannels(element);
    // real content
    element._innerHTML = element.innerHTML;
    element._innerText = element.innerText;
    if (def.template){
      element.innerHTML = def.template.innerHTML;
    }
    def.contructor.call(element);
    element.channels.in.forEach(function(channel) {
      console.log(element.id, "adding event listener for", channel);
      document.addEventListener(getChannel(channel), function(e) {
        if(e.target !== element) {
          console.log(element.id + " <- " + channel);
          element.input = {
            data: e.data,
            channel: channel
          };
        }
        return true;
      })
    });
    element.init();
  };

  Ceci.processComponent = function (element) {
    var name = element.getAttribute('name');
    var template = element.querySelector('template');
    var script = element.querySelector('script[type="text/ceci"]');
    var generator = new Function("Ceci", "return function() {" + script.innerHTML+ "}");
    var contructor = generator(Ceci);

    Ceci._components[name] = {
      template: template,
      contructor: contructor,
    };

    var existingElements = document.querySelectorAll(name);
    Array.prototype.forEach.call(existingElements, function (existingElement) {
      Ceci.convertElement(existingElement);
    });
  };

  Runner = function (callback) {
    function scrape () {
      var elements = document.querySelectorAll('element');
      elements = Array.prototype.slice.call(elements);
      elements.forEach(Ceci.processComponent);
    }

    var ceciLinks = document.querySelectorAll('link[rel=component][type="text/ceci"]');

    if (ceciLinks.length) {
      var linksLeft = ceciLinks.length;
      Array.prototype.forEach.call(ceciLinks, function (componentLink) {
        var xhr = new XMLHttpRequest(),
            docURL = componentLink.getAttribute('href');
        xhr.open('GET', docURL ,true);
        xhr.onload = function (e) {
          var fragment = document.createElement('div');
          fragment.innerHTML = xhr.response;
          if (document.body.firstChild) {
            document.body.insertBefore(fragment, document.body.firstChild);
          }
          else {
            document.body.appendChild(fragment);
          }
          if (--linksLeft === 0) {
            scrape();
            if (callback){
              callback();
            }
          }
        };
        xhr.send(null);
      });
    }
    else {
      scrape();
    }
  };

  return Runner;
});
