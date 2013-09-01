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

  function Channel(name, title, hex) {
    // make sure the name is a string
    this.name = String(name);
    this.title = title;
    this.hex = hex;
  }

  var channels = [
    new Channel('blue', 'Blue Moon', '#358CCE'),
    new Channel('red', 'Red Baloon', '#e81e1e'),
    new Channel('pink', 'Pink Heart', '#e3197b'),
    new Channel('purple', 'Purple Horseshoe', '#9f27cf'),
    new Channel('green', 'Green Clover', '#71b806'),
    new Channel('yellow', 'Yellow Pot of Gold', '#e8d71e'),
    new Channel('orange', 'Orange Star', '#ff7b00'),
    new Channel(Ceci.emptyChannel, 'Disabled', '#444')
  ];

  var broadcastersPerChannel = {};
  var listenersPerChannel = {};
  Array.prototype.forEach.call(channels, function (channel) {
    if (channel.name == Ceci.emptyChannel) return;
    broadcastersPerChannel[channel.name] = 0;
    listenersPerChannel[channel.name] = 0;
  });


  var CeciUI = function(element, def) {
    var elementAttributes = {},
        editableAttributes = [];

    function findBroadcastChannel() {
      /* we'll look through the channels looking for one which doesn't
         already have a broadcaster but has a listener */
      var channel;
      for (var i = 0; i < channels.length; i++) {
        channel = channels[i];
        var numBroadcasters = broadcastersPerChannel[channel.name];
        var numListeners = listenersPerChannel[channel.name];
        if ((numBroadcasters === 0) && (numListeners !== 0))
          return channel.name;
      }
      for (i = 0; i < channels.length; i++) {
        channel = channels[i];
        var numBroadcasters = broadcastersPerChannel[channel.name];
        var numListeners = listenersPerChannel[channel.name];
        if ((numBroadcasters === 0) && (numListeners === 0)) {
          return channel.name;
        }
      }
      return Ceci._defaultBroadcastChannel;
    }

    function findListeningChannel(){
      /* we'll look through the channels looking for one which doesn't
         already have a listener but has a broadcaster */
      var channel;
      for (var i = 0; i < channels.length; i++) {
        channel = channels[i];
        var numBroadcasters = broadcastersPerChannel[channel.name];
        var numListeners = listenersPerChannel[channel.name];
        if ((numBroadcasters !== 0) && (numListeners === 0) && channel.name != "false") {
          return channel.name;
        }
      }
      for (i = 0; i < channels.length; i++) {
        channel = channels[i];
        var numBroadcasters = broadcastersPerChannel[channel.name];
        var numListeners = listenersPerChannel[channel.name];
        if ((numBroadcasters === 0) && (numListeners === 0))
          return channel.name;
      }
      return Ceci._defaultListeningChannel;
    };

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

    element.onBroadcastChannelChanged = function(channel, oldChannel) {
      if (channel == 'default') {
        channel = findBroadcastChannel();
        element.setBroadcastChannel(channel);
        return;
      }
      setChannelIndicator(element, 'broadcast', channel);
      if (channel != "false") {
        ++broadcastersPerChannel[channel];
      }
      if (oldChannel && oldChannel != "false" && oldChannel != "default") {
        --broadcastersPerChannel[oldChannel];
      }
    };

    element.onSubscriptionChannelChanged = function(channel, listener, oldChannel) {
      if (channel == 'default') {
        channel = findListeningChannel();
        element.setSubscription(channel, listener);
        return;
      }
      if (channel != "false") {
        ++listenersPerChannel[channel];
      }
      if (oldChannel && oldChannel != 'false' && oldChannel != "default") {
        --listenersPerChannel[oldChannel];
      }
      setChannelIndicator(element, 'subscription', channel, listener);
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


  // get a Channel object given a channel name
  function getChannelByChannelName(channelName) {
    for (var i in channels) {
      if(channels[i].name === channelName) {
        return channels[i];
      }
    }
    return false;
  }


  document.addEventListener('log', function(event) {
    try {
      var scroll = $('.log .scroll');
      var eltthum;
      if (event.detail.speaker) {
        eltthum = $("<a class='speaker' elementid='" + event.detail.speaker.id + "'>" + event.detail.speaker.localName.replace('app-', '') + "</a>");
        eltthum.on('click', function(elt) {
          var eltid = elt.currentTarget.getAttribute('elementid');
          var newelt = $("#" + eltid)[0];
          Ceci.elementWantsAttention(newelt);
          selectComponent($(newelt));
        });
      }
      var line = $('<li></li>');
      var channelthumb;
      if (event.detail.channel) {
        var channel = getChannelByChannelName(event.detail.channel);
        channelthumb = $("<span class='channel'>" + channel.name + "</span>");
        channelthumb.css('backgroundColor', convertHex(channel.hex, 70));
      } else {
        channelthumb = $("<span class='channel'>&nbsp;</span>");
        channelthumb.css('backgroundColor', "rgba(102, 102, 102, .2)");
      }
      line.append(channelthumb);
      var payload = $("<div class='payload new'/>");
      if (eltthum) payload.append(eltthum);
      payload.append(" <span class='message'>" + event.detail.message + "</span>");
      line.append(payload);
      scroll.append(line);
      payload.focus(); // needed for bg animation
      payload.removeClass('new');
      if (event.detail.severity == Ceci.LOG_WTF) {
        line.addClass('severity').addClass('wtf');
      }
      scroll[0].scrollTop = scroll[0].scrollHeight;
    } catch (e) {
      console.log(e);
      console.log(e.message);
    }
  });
  Ceci.log("AppMaker designer is ready.", "");

  // return this plugin, for good measure
  return CeciUI;
});
