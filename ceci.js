define(function() {

  var Ceci = function (element, def) {

    Object.keys(def).filter(function (item) {
      return Ceci._reserved.indexOf(item) === -1;
    }).forEach(function (key) {
      var entry = def[key];
      if (typeof entry === 'function') {
        element[key] = function() {
          entry.apply(element, arguments);
        }
      }
    });

    element.defaultListener = def.defaultListener;

    element.subscriptionListeners = [];

    if(def.listeners) {
      Object.keys(def.listeners).forEach(function (key) {
        var entry = def.listeners[key];
        var entryType = typeof entry;

        if (entryType === 'function') {
          element[key] = function() {
            entry.apply(element, arguments);
          };
          element.subscriptionListeners.push(key);
        }
        else {
          throw "Listener \"" + key + "\" is not a function.";
        }
      });
    }

    element.emit = function (data) {
      if(element.broadcastChannel === Ceci._emptyChannel) return;
      var e = new CustomEvent(element.broadcastChannel, {bubbles: true, detail: data});
      element.dispatchEvent(e);
      console.log(element.id + " -> " + element.broadcastChannel);
    };

    // init must always be a function, even if it does nothing
    element.init = function () {};
    if(def.init) {
      element.init = function() {
        def.init.apply(element, arguments);
      };
    }

    // pass along the broadcast property
    element.broadcast = def.broadcast;

    // allow for event cleanup when removing an element from the DOM
    element._flatheadListeners = [];

    // add an event listener and record it got added by this element
    element.setupEventListener = function(item, event, fn) {
      item.addEventListener(event, fn);
      element._flatheadListeners.push({
        item: item,
        event: event,
        fn: fn
      });
    };

    // remove a specific event listener associated with this element
    element.discardEventListener = function(item, event, fn) {
      var listeners = element._flatheadListeners;
      for(var i=listeners.length-1, e; i>=0; i--) {
        e = listeners[i]
        if (e.item === item && e.event === event && e.fn === fn) {
          item.removeEventListener(event, fn);
          listeners.splice(i,1);
          return;
        }
      }
    };

    // remove this element from the DOM, after cleaning up all
    // outstanding event listeners
    element.removeSafely = function() {
      element._flatheadListeners.forEach(function(e) {
        e.item.removeEventListener(e.event, e.fn);
      });
      element._flatheadListeners = [];
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }

  Ceci._reserved = ['init', 'listeners', 'defaultListener'];

  Ceci.reserveKeyword = function(keyword) {
    Ceci._reserved.push(keyword);
  }

  Ceci._plugins = {
    constructor: []
  }

  Ceci.registerCeciPlugin = function(eventName, plugin) {
    Ceci._plugins[eventName].push(plugin);
  }

  Ceci._defaultBroadcastChannel = "blue";
  Ceci._defaultListeningChannel = "blue";
  Ceci._emptyChannel = "false";

  Ceci._components = {};

  // this function is only called once, when an element is instantiated.
  function getBroadcastChannel(element, original) {
    // get <broadcast> element information
    var broadcast = original.getElementsByTagName('broadcast')[0];
    if (broadcast){
      var channel = broadcast.getAttribute("on");
      if (channel) {
        return channel;
      }
    }
    // if no broadcast channel is specified, but this is a broadcast
    // element, use the default channel. Otherwise, don't broadcast
    return (element.broadcast ? Ceci._defaultBroadcastChannel : Ceci._emptyChannel);
  }

  // this function is only called once, when an element is instantiated.
  function getSubscriptions(element, original) {
    var subscriptions = original.getElementsByTagName('listen');
    subscriptions = Array.prototype.slice.call(subscriptions);

    if(subscriptions.length === 0) {
      if(!element.defaultListener) {
        return [];
      }
      return [{
        listener: element.defaultListener,
        channel: Ceci._defaultListeningChannel
      }];
    }

    subscriptions = subscriptions.map(function (e) {
      var channel = e.getAttribute("on");
      var listener = e.getAttribute("for");

      return {
        listener: listener,
        channel: channel
      };
    });

    return subscriptions;
  }

  function setupBroadcastLogic(element, original) {
    // get <broadcast> rules from the original declaration
    element.broadcastChannel = getBroadcastChannel(element, original);
    if(element.onBroadcastChannelChanged) {
      element.onBroadcastChannelChanged(element.broadcastChannel);
    }
    // set property on actual on-page element
    element.setBroadcastChannel = function(channel) {
      element.broadcastChannel = channel;
      if(element.onBroadcastChannelChanged) {
        element.onBroadcastChannelChanged(channel);
      }
    };
  }

  function setupSubscriptionLogic(element, original) {
    // get <listen> rules from the original declaration
    element.subscriptions = getSubscriptions(element, original);
    if(element.onSubscriptionChannelChanged) {
      element.subscriptions.forEach(function(s){
        element.onSubscriptionChannelChanged(s.channel, s.listener);
      });
    }
    var generateListener = function(element, channel, listener) {
      return function(e) {
        if(e.target.id !== element.id) {
          console.log(element.id + " <- " + channel + "/" + listener);
          element[listener](e.detail, channel);
        }
      }
    }
    // set properties on actual on-page element
    element.setSubscription = function(channel, listener) {
      var append = true, fn;
      element.subscriptions.forEach(function(s) {
        if(s.listener === listener) {
          // remove the old event listening
          fn = element[listener].listeningFunction;
          if(fn) {
            console.log("removing "+s.channel+"/"+listener+" pair");
            element.discardEventListener(document, s.channel, fn);
          }
          // update the channel
          s.channel = channel;
          // bind the new event listening
          if(channel !== Ceci._emptyChannel) {
            fn = generateListener(element, s.channel, s.listener);
            console.log("adding "+s.channel+"/"+listener+" pair");
            element.setupEventListener(document, s.channel, fn);
          } else {
            fn = false;
          }
          element[listener].listeningFunction = fn;
          append = false;
        }
      });
      if(append) {
        fn = generateListener(element, channel, listener);
        element[listener].listeningFunction = fn;
        console.log("adding "+channel+"/"+listener+" pair");
        element.setupEventListener(document, channel, fn);
        element.subscriptions.push({
          listener: listener,
          channel: channel
        });
      }
      if(element.onSubscriptionChannelChanged) {
        element.onSubscriptionChannelChanged(channel, listener);
      }
    };
    element.removeSubscription = function(channel, listener) {
      var filter = function(s) {
        return !(s.channel === channel && s.listener === listener);
      };
      // single arg: remove listener, regardless of its channel
      if(channel && !listener) {
        listener = channel;
        filter = function(s) {
          return (s.listener !== listener);
        };
      }
      e.subscriptions = e.subscriptions.filter(filter);
    };

    element.subscriptions.forEach(function (s) {
      var fn = generateListener(element, s.channel, s.listener);
      element[s.listener].listeningFunction = fn;
      element.setupEventListener(document, s.channel, fn);
    });

  }

  Ceci.convertElement = function (element, callback) {
    var def = Ceci._components[element.localName],
        original = element.cloneNode(true);

    // real content
    element._innerHTML = element.innerHTML;
    element._innerText = element.innerText;

    if (def.template){
      element.innerHTML = def.template.innerHTML;
    }

    if (def.description) {
      element.description = def.description;
    }

    var init = function(){
      setupBroadcastLogic(element, original);
      setupSubscriptionLogic(element, original);

      // run any plugins that hook into the constructor
      Ceci._plugins.constructor.forEach(function(plugin) {
        plugin(element, def);
      });

      element.init();
      callback(element);
    };

    def.constructor.call(element, function(){
      init();
    });

    if (typeof element.init === 'function'){
      init();
    }
  };

  Ceci.processComponent = function (element) {
    var name = element.getAttribute('name');
    var template = element.querySelector('template');
    var script = element.querySelector('script[type="text/ceci"]');
    var description = element.querySelector('description');

    var generator = null;

    try{
      generator = new Function("Ceci", "return function(callback) {" + script.innerHTML+ "}");
    }
    catch(e){
      if (e.name === 'SyntaxError') {
        e.message += " in definition of component \"" + name + "\".";
        throw e;
      }
      else {
        throw e;
      }
    }
    var constructor = generator(Ceci);

    Ceci._components[name] = {
      template: template,
      constructor: constructor,
      description: description
    };

    var existingElements = document.querySelectorAll(name);
    Array.prototype.forEach.call(existingElements, function (existingElement) {
      Ceci.convertElement(existingElement);
    });
  };

  function scrape (callOnComplete) {
    var elements = document.querySelectorAll('element');
    elements = Array.prototype.slice.call(elements);
    elements.forEach(Ceci.processComponent);
    if (callOnComplete){
      callOnComplete(Ceci._components);
    }
  }

  Ceci.load = function (callOnComplete) {
    var ceciLinks = document.querySelectorAll('link[rel=component][type="text/ceci"]');

    if (ceciLinks.length) {
      var linksLeft = ceciLinks.length;
      Array.prototype.forEach.call(ceciLinks, function (componentLink) {
        var xhr = new XMLHttpRequest(),
            docURL = componentLink.getAttribute('href');
        xhr.open('GET', docURL ,true);
        xhr.onload = function (e) {
          var fragment = document.createElement('div');
          fragment.setAttribute("style","display:none!important");
          fragment.innerHTML = xhr.response;
          if (document.body.firstChild) {
            document.body.insertBefore(fragment, document.body.firstChild);
          }
          else {
            document.body.appendChild(fragment);
          }
          if (--linksLeft === 0) {
            scrape(callOnComplete);
          }
        };
        xhr.send(null);
      });
    }
    else {
      scrape(callOnComplete);
    }
  };

  return Ceci;
});
