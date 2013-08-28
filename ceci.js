define(function() {
  "use strict";

  // tracking auto-generated IDs
  var counts = {};

  /**
   * Note: we're not using this as an object constructor,
   * merely as the main entrypoint into Ceci for custom
   * elements.
   */
  var Ceci = function (element, buildProperties) {
    Object.keys(buildProperties).filter(function (item) {
      return Ceci._reserved.indexOf(item) === -1;
    }).forEach(function (property) {
      var entry = buildProperties[property];
      if (typeof entry === 'function') {
        element[property] = function() {
          entry.apply(element, arguments);
        };
      }
    });

    if(buildProperties.editable) {
      element.editableAttributes = [];
      Object.keys(buildProperties.editable).forEach(function(attribute) {
        element.editableAttributes.push(attribute);
      });
    }

    element.defaultListener = buildProperties.defaultListener;

    element.subscriptionListeners = [];

    if(buildProperties.listeners) {
      Object.keys(buildProperties.listeners).forEach(function (listener) {
        var entry = buildProperties.listeners[listener];
        var entryType = typeof entry;

        if (entryType === 'function') {
          element[listener] = function() {
            entry.apply(element, arguments);
          };
          element.subscriptionListeners.push(listener);
        } else {
          throw "Listener \"" + listener + "\" is not a function.";
        }
      });
    }

    element.emit = function (data) {
      if(element.broadcastChannel === Ceci.emptyChannel) return;
      var e = new CustomEvent(element.broadcastChannel, {bubbles: true, detail: data});
      element.dispatchEvent(e);
      if(element.onOutputGenerated) {
        element.onOutputGenerated(element.broadcastChannel, data);
      }
      console.log(element.id + " -> " + element.broadcastChannel);
    };

    // init must always be a function, even if it does nothing
    element.init = function () {};
    if(buildProperties.init) {
      element.init = function() {
        buildProperties.init.apply(element, arguments);
      };
    }

    // pass along the broadcast property
    element.broadcast = buildProperties.broadcast;

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
        e = listeners[i];
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
    };

    element.describe = function() {
      return Ceci.dehydrate(element);
    };

    // run any plugins that hook into the constructor
    Ceci._plugins.constructor.forEach(function(plugin) {
      plugin(element, buildProperties);
    });
  };

  // administrative values and objects
  Ceci._reserved = ['init', 'listeners', 'defaultListener'];
  Ceci._plugins = {
    constructor: [],
    onload: []
  };
  Ceci._defaultBroadcastChannel = "blue";
  Ceci._defaultListeningChannel = "blue";
  Object.defineProperty(Ceci, "emptyChannel", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: "false"
  });
  Ceci._components = {};

  /**
   * Register a plugin into Ceci
   */
  Ceci.registerCeciPlugin = function(eventName, plugin) {
    Ceci._plugins[eventName].push(plugin);
  };

  /**
   * Plugins can add additional reserved words to Ceci's list
   */
  Ceci.reserveKeyword = function(keyword) {
    Ceci._reserved.push(keyword);
  };

  /**
   * This function is only called once, when an element
   * is instantiated, and returns the name of the channel
   * the element should be listening to "by default".
   */
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
    return (element.broadcast ? Ceci._defaultBroadcastChannel : Ceci.emptyChannel);
  }

  /**
   * Set up the broadcasting behaviour for an element, based
   * on the broadcasting properties it inherited from the
   * <element> component master.
   */
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

  /**
   * This function is only called once, when an element is
   * instantiated, and returns the list of channel subscriptions
   * this element is supposed to have, "by default".
   */
  function getSubscriptions(element, original) {
    var listenElements = original.getElementsByTagName('listen');
    listenElements = Array.prototype.slice.call(listenElements);

    var predefinedListeners = [];
    var subscriptions = listenElements.map(function (e) {
      predefinedListeners.push(e.getAttribute("for"));
      return {
        listener: e.getAttribute("for"),
        channel: e.getAttribute("on")
      };
    });

    element.subscriptionListeners.forEach(function(listener) {
      if(predefinedListeners.indexOf(listener) !== -1) return;
      var subscription = {
        channel: Ceci.emptyChannel,
        listener: listener
      };
      if(listener === element.defaultListener) {
        subscription.channel = Ceci._defaultListeningChannel;
      }
      subscriptions.push(subscription);
    });

    return subscriptions;
  }

  /**
   * Set up the listening behaviour for an element, based
   * on the broadcasting properties it inherited from the
   * <element> component master.
   */
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
          var data = e.detail;
          element[listener](data, channel);
          if(element.onInputReceived) {
            element.onInputReceived(channel, data);
          }
        }
      };
    };
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
          if(channel !== Ceci.emptyChannel) {
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
      element.subscriptions = element.subscriptions.filter(filter);
    };

    element.subscriptions.forEach(function (s) {
      var fn = generateListener(element, s.channel, s.listener);
      element[s.listener].listeningFunction = fn;
      element.setupEventListener(document, s.channel, fn);
    });
  }

  // describe an element as a terse JSON object
  Ceci.dehydrate = function(element) {
    return {
      tagname: element.localName,
      id: element.id,
      broadcast: element.broadcastChannel,
      listen: element.subscriptions.slice(),
      attributes: (function() {
        if (!element.editableAttributes) return [];
        return element.editableAttributes.map(function(attribute) {
          var value = element.getAttribute(attribute);
          if(!value) return false;
          return {
            name: attribute,
            value: value
          };
        }).filter(function(v) { return !!v; });
      }())
    };
  };

  /**
   * Converts a JSON object into a regular object. For converting.
   */
  Ceci.rehydrate = function(description) {
    var element = document.createElement(description.tagname);
    element.id = description.id;
    var content = "";
    if(description.broadcast.channel !== Ceci.emptyChannel) {
      content += '<broadcast on="'+description.broadcast+'"></broadcast>\n';
    }
    description.listen.forEach(function(listen) {
      if(listen.channel !== Ceci.emptyChannel) {
        content += '<listen on="'+listen.channel+'" for="'+listen.listener+'"></listne>\n';
      }
    });
    element.innerHTML = content;
    description.attributes.forEach(function(item) {
      element.setAttribute(item.name, item.value);
    });
    return element;
  };

  /**
   * Convert an element of tagname '...' based on the component
   * description for the custom element '...'
   */
  Ceci.convertElement = function (instance, completedHandler) {
    var componentDefinition = Ceci._components[instance.localName],
        originalElement = instance.cloneNode(true);

    // does this instance need an id?
    if(!instance.id) {
      var ln = instance.localName.toLowerCase();
      instance.id = ln + "-" + counts[ln]++;
    }

    // cache pre-conversion content
    instance._innerHTML = instance.innerHTML;
    instance._innerText = instance.innerText;

    // apply the element's template
    if (componentDefinition.template){
      // TODO: should we do a <content></content> replacement?
      instance.innerHTML = componentDefinition.template.innerHTML;
    }

    // if the <element> had a description block, bind this
    // to the instance as well, for future reference.
    if (componentDefinition.description) {
      instance.description = componentDefinition.description;
    }

    // set up the hook for post constructor callbacks
    var finalize = function() {
      finalize.called = true;
      setupBroadcastLogic(instance, originalElement);
      setupSubscriptionLogic(instance, originalElement);
      instance.init();
      if(completedHandler) {
        completedHandler(instance);
      }
    };
    finalize.called = false;

    componentDefinition.constructor.call(instance, finalize);

    if (typeof instance.init === 'function') {
      if(!finalize.called) {
        finalize();
      }
    }
  };

  /**
   * Process an individual <element> so that the element it
   * defines can be used on a web page.
   */
  Ceci.processComponent = function (element) {
    var name = element.getAttribute('name'),
        script = element.querySelector('script[type="text/ceci"]'),
        generator;

    var localName = element.getAttribute("name").toLowerCase();
    if(!counts[localName]) {
      counts[localName] = 1;
    }

    try {
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
    var constructor = generator(Ceci),
        description = element.querySelector('description'),
        template = element.querySelector('template');

    // Store this element's defining features
    // so that we can reference them when an element
    // with the corresponding tagname is user.
    Ceci._components[name] = {
      constructor: constructor,
      description: description,
      template: template
    };

    // After chronicling, also check whether there happen to
    // already be elements with this tagname on the page that
    // we need to immediately convert
    var existingElements = document.querySelectorAll(name);
    Array.prototype.forEach.call(existingElements, function (existingElement) {
      Ceci.convertElement(existingElement);
    });
  };

  /**
   * Find all <element> elements, and process them so that we
   * can build instances on a page.
   */
  var processComponents = function(fragments, callOnComplete) {
    if(fragments) {
      var elements = fragments.querySelectorAll('element');
      elements = Array.prototype.slice.call(elements);
      elements.forEach(Ceci.processComponent);
    }

    Ceci._plugins.onload.forEach(function(fn) {
      fn(Ceci._components);
    });

    if (callOnComplete){
      callOnComplete(Ceci._components);
    }
  };

  /**
   * Load all web components from <link rel="component">
   */
  Ceci.load = function (callOnComplete) {
    var ceciLinks = document.querySelectorAll('link[rel=component][type="text/ceci"]');

    if (ceciLinks.length === 0) {
      return processComponents(false, callOnComplete);
    }

    var linksLeft = ceciLinks.length,
        fragments = document.createElement("div"),
        loadComponents = function (componentLink) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', componentLink.getAttribute('href'), true);
          xhr.onload = function (e) {
            var fragment = document.createElement('div');
            fragment.innerHTML = xhr.response;
            fragments.appendChild(fragment);
            if (--linksLeft === 0) {
              processComponents(fragments, callOnComplete);
            }
          };
          xhr.send(null);
        };
    Array.prototype.forEach.call(ceciLinks, loadComponents);
  };

  // and lastly, an AMD module return
  return Ceci;
});
