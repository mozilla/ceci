define(function() {
  "use strict";

  // tracking auto-generated IDs
  var elementIDCounts = {};

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
          return entry.apply(element, arguments);
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

    element.broadcastChannels = buildProperties.broadcasts ? buildProperties.broadcasts.slice() : [];

    if(buildProperties.listeners) {
      Object.keys(buildProperties.listeners).forEach(function (listener) {
        var entry = buildProperties.listeners[listener];
        var entryType = typeof entry;

        if (entryType === 'function') {
          element[listener] = function() {
            try {
              return entry.apply(element, arguments);
            } catch (e) {
              console.log("Exception calling listener: " + listener + " of " + element.id);
              console.log(e.message);
              console.log(e.stack);
            }
          };
          element.subscriptionListeners.push(listener);
        } else {
          throw "Listener \"" + listener + "\" is not a function.";
        }
      });
    }

    if(buildProperties.endpoint) {
      element.endpoint = true;
    }

    // XXXsecretrobotron: Temporary fill for elements calling `this.log`. Hooked up to
    // Ceci.log by forcing each arg to be a string.
    element.log = function () {
      var argStr = Array.prototype.map.call(arguments, function (arg) {
        return arg ? arg.toString() : '';
      }).join(' ');
      Ceci.log(element, argStr);
    };

    element.emit = function (type, data, extra) {
      data = data || type;

      if (element.endpoint) return;

      var broadcastElement = element.querySelector('broadcast[from="' + type + '"]');

      if (!broadcastElement) return;

      var channel = broadcastElement.getAttribute('on');

      if (!channel) return;

      var e = new CustomEvent(channel, {bubbles: true, detail: {
        data: data,
        extra: extra
      }});

      Ceci.log(element, "sends '" + data.toString() + "' on "+ channel + " channel", channel);

      element.dispatchEvent(e);

      if(element.onOutputGenerated) {
        element.onOutputGenerated(channel, data);
      }
    };

    // init must always be a function, even if it does nothing
    element.init = function () {};
    if(buildProperties.init) {
      element.init = function() {
        buildProperties.init.apply(element, arguments);
      };
    }

    element.unload = function () {};
    if (typeof buildProperties.onUnload === 'function'){
      element.unload = function () {
        buildProperties.onUnload.apply(element);
      };
    }

    // pass along the broadcast property
    element.broadcast = buildProperties.broadcast || element.emit;

    // add an event listener and record it got added by this element
    element.setupEventListener = function(item, event, fn, listenerName) {
      if (event) {
        var listenElement = element.querySelector('listen[on="' + event + '"][for="' + listenerName + '"]');

        if (!listenElement) {
          listenElement = document.createElement('listen');
          element.appendChild(listenElement);
        }
        else {
          item.removeEventListener(event, listenElement._listeningFunction);
        }

        listenElement.setAttribute('on', event);
        listenElement.setAttribute('for', listenerName);
        listenElement._listeningFunction = fn;
        listenElement._listeningItem = item;

        item.addEventListener(event, fn);
      }
    };

    // remove a specific event listener associated with this element
    element.discardEventListener = function(item, event, listenerName) {
      var subscriptionElement = element.querySelector('listen[on="' + event + '"][for="' + listenerName + '"]');
      if (subscriptionElement) {
        element.removeChild(subscriptionElement);
        item.removeEventListener(event, element._listeningFunction);
      }
    };

    // remove this element from the DOM, after cleaning up all
    // outstanding event listeners
    element.removeSafely = function() {
      Array.prototype.forEach.call(element.querySelectorAll('listen'), function (listenElement) {
        listenElement._listeningItem.removeEventListener(listenElement.getAttribute('on'), listenElement._listeningFunction);
      });

      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }

      element.unload();

      Ceci.fireElementRemovedEvent(element);
      Ceci.fireChangeEvent();
    };

    element.describe = function() {
      return Ceci.dehydrate(element);
    };

    element.lookAtMe = function() {
      Ceci.elementWantsAttention(this);
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
    onload: [],
    onChange: [],
    onElementRemoved: []
  };

  Ceci.fireChangeEvent = function(){
    Ceci._plugins.onChange.forEach(function(plugin) {
      plugin();
    });
  };

  Ceci.fireElementRemovedEvent = function(element){
    Ceci._plugins.onElementRemoved.forEach(function(plugin) {
      plugin(element);
    });
  };

  Ceci._defaultBroadcastChannel = "blue";
  Ceci._defaultListeningChannel = "blue";
  Object.defineProperty(Ceci, "emptyChannel", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: false
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
   * Set up the broadcasting behaviour for an element, based
   * on the broadcasting properties it inherited from the
   * <element> component master.
   */
  function setupBroadcastLogic (element, original) {
    // set property on actual on-page element
    element.setBroadcast = function (channel, name) {
      var broadcastElement;

      broadcastElement = element.querySelector('broadcast[from="' + name + '"]');
      if (channel) {
        if (!broadcastElement) {
          broadcastElement = document.createElement('broadcast');
          element.appendChild(broadcastElement);
        }
        broadcastElement.setAttribute('on', channel);
        broadcastElement.setAttribute('from', name);
      }
      else if (!channel && broadcastElement) {
        element.removeChild(broadcastElement);
      }

      if(element.onBroadcastChannelChanged) {
        element.onBroadcastChannelChanged(channel, name);
      }
    };

    // These are the broadcast types listed in the component definition
    var broadcastChannels = element.broadcastChannels.slice();

    // get <broadcast> rules from the original declaration
    var broadcasts = original.querySelectorAll('broadcast');
    Array.prototype.forEach.call(broadcasts, function (broadcastElement) {
      var broadcastName = broadcastElement.getAttribute('from');
      var broadcastIndex = broadcastChannels.indexOf(broadcastName);

      // If the broadcast type was in those defined by the component, process it, and remove it from the list
      if (broadcastIndex > -1) {
        element.setBroadcast(broadcastElement.getAttribute('on'), broadcastName);
        broadcastChannels.splice(broadcastIndex, 1);
      }
    });

    // Set whatever is left to defaults
    broadcastChannels.forEach(function (broadcastName) {
      element.setBroadcast(Ceci._defaultBroadcastChannel, broadcastName);
    });
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

    var generateListener = function(element, channel, listener) {
      return function(e) {
        if(e.target.id !== element.id) {
          var data = e.detail.data;
          var extra = e.detail.extra;
          var eventSource = e.target;

          element[listener](data, channel, extra, eventSource);

          if(element.onInputReceived) {
            element.onInputReceived(channel, data);
          }
        }
      };
    };

    // set properties on actual on-page element
    element.setSubscription = function(channel, listener) {
      if (channel) {
        element.setupEventListener(document, channel, generateListener(element, channel, listener), listener);
      }
      else {
        element.discardEventListener(document, channel, listener);
      }

      if(element.onSubscriptionChannelChanged) {
        element.onSubscriptionChannelChanged(channel, listener);
      }
    };

    element.removeSubscription = function(channel, listener) {
      element.discardEventListener(document, channel, listener);
    };

    getSubscriptions(element, original).forEach(function (s) {
      element.setSubscription(s.channel, s.listener);
    });
  }

  /**
   * Convert an element of tagname '...' based on the component
   * description for the custom element '...'
   */
  Ceci.convertElement = function (instance, completedHandler, noWiring) {
    var componentDefinition = Ceci._components[instance.localName],
        originalElement = instance.cloneNode(true);

    // does this instance need an id?
    if(!instance.id || instance !== document.querySelector('#' + instance.id)) {
      var ln = instance.localName.toLowerCase();
      var newId;
      while (true) {
        newId = ln + "-" + (elementIDCounts[ln]++);
        if (!document.querySelector('#' + newId)) {
          break;
        }
      }
      instance.id = newId;
    }

    // Really, really make sure it's there.
    instance.setAttribute('id', instance.id);

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
    if (componentDefinition.description && typeof instance.description === 'undefined') {
      var desc = componentDefinition.description.cloneNode(true);
      Object.defineProperty(instance, "description", {
        get: function() { return desc; },
        set: function() {}
      });
    }

    // if the <element> had a thumbnail block, bind this
    // to the instance as well, for future reference.
    if (componentDefinition.thumbnail && typeof instance.thumbnail === 'undefined') {
      var thumb = componentDefinition.thumbnail.cloneNode(true);
      Object.defineProperty(instance, "thumbnail", {
        get: function() { return thumb; },
        set: function() {}
      });
    }

    var t = this;

    // set up the hook for post constructor callbacks
    var finalize = function() {
      finalize.called = true;
      if (!noWiring) {
        setupBroadcastLogic(instance, originalElement);
        setupSubscriptionLogic(instance, originalElement);
      }
      /*
       * "t" has been set up to be either an instance of Ceci.App
       * or something we don't care about. It's a bit hacky, but
       * if the context has an id, we use it.
       */
      instance.init.call(instance, {appId: t.id ? t.id : null});
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
    if(!elementIDCounts[localName]) {
      elementIDCounts[localName] = 1;
    }

    try {
      generator = new Function("Ceci", "return function(callback) {" + script.innerHTML+ "}");
    }
    catch(e){
      if (e.name === 'SyntaxError') {
        e.message += " in definition of component \"" + name + "\".";
        console.log(e.message);
        console.log(e.stack);
        throw e;
      }
      else {
        throw e;
      }
    }
    var constructor = generator(Ceci),
        description = element.querySelector('description'),
        thumbnail = element.querySelector('thumbnail'),
        friendsBlock = element.querySelector('friends'),
        template = element.querySelector('template');

    var friends = [];
    if (friendsBlock) {
      friends = friendsBlock.innerHTML.split(',');
    }

    // Store this element's defining features
    // so that we can reference them when an element
    // with the corresponding tagname is user.
    Ceci._components[name] = {
      constructor: constructor,
      description: description,
      thumbnail: thumbnail,
      friends: friends,
      template: template
    };
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
          xhr.overrideMimeType('text/plain');
          xhr.send(null);
        };
    Array.prototype.forEach.call(ceciLinks, loadComponents);
  };

  Ceci.convertContainer = function (container, convertElementCalback) {
    Object.keys(Ceci._components).forEach(function(name){
      Array.prototype.forEach.call(container.querySelectorAll(name), function (element){
        Ceci.convertElement(element, convertElementCalback);
      });
    });
  };

  Ceci.log = function(element, message, channel, severity) {
    if (!message) {
      message = element;
      element = null;
    }
    if (message.length > 200) message = message.slice(0,200) + '…';
    var event = new CustomEvent('log',
      {detail:
        {speaker: element || null,
         message: message || null,
         channel: channel || null,
         severity: severity || null}
       });
    document.dispatchEvent(event);
  };

  Ceci.LOG_WTF = "WTF";

  // and lastly, an AMD module return
  return Ceci;
});
