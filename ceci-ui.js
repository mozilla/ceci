define(["ceci"], function(Ceci) {
  "use strict";

  var broadcastBlock = document.createElement("broadcast");
  broadcastBlock.setAttribute("class","channel-visualisation broadcast-channels");

  var subscriptionBlock = document.createElement("listen");
  subscriptionBlock.setAttribute("class","channel-visualisation subscription-channels");

  var channelBlock = document.createElement("div");
  channelBlock.setAttribute("class", "channel");

  var setChannelIndicator = function(element, type, channel, listener) {
    // do we need to add the visualisation block?
    if(!element.querySelector(".broadcast-channels")) {
      element.appendChild(broadcastBlock.cloneNode(true));
      element.appendChild(subscriptionBlock.cloneNode(true));
    }

    // get the selector for the element whose color we need to change
    var sel = "." + type + "-channels",
        lsel = sel + " .channel" + (listener ? '.' + listener : '');

    if(!element.querySelector(lsel)) {
      var cblock = channelBlock.cloneNode(true);
      if(listener) {
        cblock.classList.add(listener);
      }
      element.querySelector(sel).appendChild(cblock);
    }

    // set relevant channel color, or remove if disabled
    var channelElement = element.querySelector(lsel);

    if(channel === Ceci.emptyChannel) {
      channelElement.parentNode.removeChild(channelElement);
    } else {
      channelElement.setAttribute("color",channel);
    }

    // Hide all but the first indicator for this particular color
    // We only want to show one indicator per color
    sel += " .channel[color="+channel+"]";
    var indicators  = element.querySelectorAll(sel);
    if(indicators.length > 0) {
      indicators[0].style.display = "block";
      for(var i=1; i<indicators.length; i++) {
        indicators.item(i).style.display = "none";
      }
    }
  };

  var CeciUI = function(element, def) {
    var elementAttributes = {},
        editableAttributes = [];

    var bindAttributeChanging = function(target, attrName, fallthrough) {
      // value tracking as "real" value
      var v = false;

      Object.defineProperty(target, attrName, {
        get: function() {
          return v;
        },
        set: function(v) {
          target.setAttribute(attrName, v);
        }
      });

      // feedback and mutation observing based on HTML attribute
      var handler = function(mutations) {
        mutations.forEach(function(mutation) {
          v = target.getAttribute(attrName);
          fallthrough.call(target, v);
        });
      };

      var observer = new MutationObserver(handler);
      var config = { attributes: true, attributeFilter: [attrName] };

      observer.observe(target, config);
    };

    if (def.editable) {
      Object.keys(def.editable).forEach(function (key) {
        var props = def.editable[key];
        bindAttributeChanging(element, key, props.postset);
        editableAttributes.push(key);
        eak = {};
        Object.keys(props).forEach(function(pkey) {
          if (pkey === "postset") return;
          eak[pkey] = props[pkey];
        });
        elementAttributes[key] = eak;
      });
    }

    element.getEditableAttributes = function() {
      return editableAttributes;
    };

    element.getAttributeDefinition = function(attrName) {
      return elementAttributes[attrName];
    };

    element.onBroadcastChannelChanged = function(channel) {
      setChannelIndicator(element, 'broadcast', channel);
    };

    element.onSubscriptionChannelChanged = function(channel, listener) {
      setChannelIndicator(element, 'subscription', channel, listener);
    };
  };

  // register ourselves with Ceci
  Ceci.reserveKeyword("editable");
  Ceci.registerCeciPlugin("constructor", CeciUI);

  // return this plugin, for good measure
  return CeciUI;
});
