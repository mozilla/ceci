define(["jquery", "ceci"], function($, Ceci) {
  "use strict";

  var broadcastBlock = document.createElement("broadcast");
  broadcastBlock.setAttribute("class","channel-visualisation broadcast-channels");

  var subscriptionBlock = document.createElement("listen");
  subscriptionBlock.setAttribute("class","channel-visualisation subscription-channels");

  var subscriptionMenuToggle = document.createElement("div");
  subscriptionMenuToggle.setAttribute("class", "channel-menu-toggle");
  subscriptionBlock.appendChild(subscriptionMenuToggle.cloneNode(true));

  var broadcastMenuToggle = document.createElement("div");
  broadcastMenuToggle.setAttribute("class", "channel-menu-toggle");
  broadcastBlock.appendChild(broadcastMenuToggle.cloneNode(true));

  var channelDot = document.createElement("div");
  channelDot.setAttribute("class", "color dot");

  var channelBlock = document.createElement("div");

  channelBlock.setAttribute("class", "channel");
  channelBlock.appendChild(channelDot.cloneNode(true));

  // channel visualisation animations
  var signalSpeed = 1;
  var bubbleDuration = 1;

  var setChannelIndicator = function(element, type, channel, listener) {
    // do we need to add the visualisation block?
    if(!element.querySelector(".broadcast-channels")) {
      element.appendChild(broadcastBlock.cloneNode(true));
      element.appendChild(subscriptionBlock.cloneNode(true));
    }

    // get the selector for the element whose color we need to change
    var sel = "." + type + "-channels",
        lsel = sel + " .channel" + (listener ? '.' + listener : ''),
        cblock;

    if(!element.querySelector(lsel)) {
      cblock = channelBlock.cloneNode(true);
      if(listener) {
        cblock.classList.add(listener);
      }
      element.querySelector(sel).appendChild(cblock);
    }

    // set relevant channel color, or remove if disabled
    var channelElement = cblock || element.querySelector(lsel);
    channelElement.setAttribute("color",channel);
    channelElement.setAttribute("title", listener ?  listener : "broadcast channel");
  };

  var CeciUI = function(element, def) {
    var elementAttributes = {},
        editableAttributes = [];

    var bindAttributeChanging = function(target, attrName, fallthrough) {
      // value tracking as "real" value
      var v = false;

      Object.defineProperty(target, attrName, {
        enumerable: false,
        configurable: true,
        get: function() {
          return v;
        },
        set: function(v) {
          Ceci.fireChangeEvent();
          target.setAttribute(attrName, v);
        }
      });

      // feedback and mutation observing based on HTML attribute
      var handler = function(mutations) {
        mutations.forEach(function(mutation) {
          v = target.getAttribute(attrName);
          if (fallthrough) {
            fallthrough.call(target, v);
          }
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
        var eak = {};
        Object.keys(props).forEach(function(pkey) {
          if (pkey === "postset") return;
          eak[pkey] = props[pkey];
        });
        elementAttributes[key] = eak;
      });
    }

    element.addDataBubble = function(element, direction, data) {
      var timeout = (direction === "out" ? 0 : signalSpeed * 1000);
      setTimeout(function() {
        var bubble = document.createElement("div");
        $(bubble).text(data).addClass("bubblepopup").addClass("bubblepop");
        $(element).append(bubble);
        setTimeout(function() {
          $(bubble).remove();
        }, bubbleDuration * 1000);
      }, timeout);
    };

    element.addIndicator = function(element, direction) {
      var indicator = document.createElement("div");
      $(element).append(indicator);
      $(indicator).addClass("indicator indicator-" + direction);
      var signalSpeedCSS = signalSpeed + "s";
      $(indicator).css({
        "-webkit-animation-duration": signalSpeedCSS,
        "-moz-animation-duration": signalSpeedCSS
      });
      if(direction == "out") {
        var colors = $(element).find(".color"),
            removePulse = function() {
              $(colors).removeClass("pulse");
            };
        colors.addClass("pulse").bind("webkitAnimationEnd animationend", removePulse);
      }
      var removeIndicator = function() {
        $(indicator).remove();
      };
      setTimeout(removeIndicator, signalSpeed * 1000);
    };

    element.getEditableAttributes = function() {
      return editableAttributes;
    };

    element.getAttributeDefinition = function(attrName) {
      return elementAttributes[attrName];
    };

    element.onBroadcastChannelChanged = function(channel) {
      setChannelIndicator(element, 'broadcast', channel);
      Ceci.fireChangeEvent();
    };

    element.onSubscriptionChannelChanged = function(channel, listener) {
      setChannelIndicator(element, 'subscription', channel, listener);
      Ceci.fireChangeEvent();
    };

    element.onOutputGenerated = function(channel, output) {
      var bc = element.querySelector(".broadcast-channels .channel[color="+channel+"]");
      element.addIndicator(bc, "out");
      element.addDataBubble(bc, "out", output);
    };

    element.onInputReceived = function(channel, input) {
      var bc = element.querySelector(".subscription-channels .channel[color="+channel+"]");
      element.addIndicator(bc, "in");
      element.addDataBubble(bc, "in", input);
    };

    element.log = function(message, channel, severity) {
      if (severity === undefined) severity = 0;
      Ceci.log(element, message, channel, severity);
    };

    element.lookAtMe = function() {
      Ceci.elementWantsAttention(this);
    };
  };

  // register ourselves with Ceci
  Ceci.reserveKeyword("editable");
  Ceci.registerCeciPlugin("constructor", CeciUI);


  // return this plugin, for good measure
  return CeciUI;
});
