/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["ceci-cards", "ceci-utils"], function(Ceci, Utils) {
  "use strict";

  /**
   *
   * Executes a callback with a new server-generated UUID
   * If only a callback is specified (first arg), it's called with no context,
   * otherwise the context is passed so one can reference "this"
   *
   * It's likely over-complicated, but I (wex) am writing code while tired,
   * hence my sense of obligation to make excuses in multi-line comments.
   *
   */
  function getUuid(contextOrCallback, callback) {
    Utils.get('/store/uuid', function(data) {
      if (!callback){
        if (typeof contextOrCallback === 'function'){
          callback = contextOrCallback;
          contextOrCallback = null;
        }
      }

      var context = contextOrCallback;

      if (callback){
        if (context){
          callback.call(context, data);
        }
        else {
          callback(data);
        }
      }
      else{
        throw "No callback specified for getUuid(); nothing to do!";
      }
    });
  }

  var onLoadListeners = [];

  var App = function(params) {

    //TODO: This is faking the app "knowing" about cards, when we refactor, this should go
    if (params.onCardChange){
      Ceci.onCardChange(params.onCardChange);
    }
    if (params.onCardAdded){
      Ceci.onCardAdded(params.onCardAdded);
    }

    this.componentAddedCallback = typeof params.onComponentAdded === 'function' ? params.onComponentAdded : function(){};

    this.container = params.container;

    // generate a unique id that increments per tag ('moz-button-1', 'moz-button-2', etc.)
    this.tagids = {};
    this.generateTagId = function (tagName) {
      if (!this.tagids[tagName]){
        this.tagids[tagName] = 0;
      }
      return tagName + '-' + String(++this.tagids[tagName]);
    };

    /*
     * Here we clone each card and go two levels down, then construct listeners
     *  <div class="ceci-card">
     *    <div class="fixed-top">
     *      <app-* >...
     *    </div>
     *    <div class="fixed-bottom">
     *      <app-* >...
     *    </div>
     *    <div class="phone-canvas">
     *      <app-* >...
     *    </div>
     *  </div>
     */
    this.serialize = function(){
      return this.getPortableAppTree().innerHTML;
    };

    this.addComponent = function (tagName, callback) {
      var component = document.createElement(tagName);
      component.setAttribute('id', this.generateTagId(tagName));

      var t = this;

      if (typeof callback === 'function'){
        callback(component);
      }
      Ceci.convertElement(component, function(){
        t.componentAddedCallback(component);
      });
    };

    this.addCard = function (){
      var card = Ceci.createCard(this.container);
      return card;
    };

    this.duplicateCard = function (card) {
      var cardClone = card.cloneNode(true);
      this.getPortableCardTree(cardClone);
      Ceci.addCard(this.container, cardClone, this.componentAddedCallback);
      return cardClone;
    };

    this.getPortableCardTree = function (card) {

      function cleanAttributes (element, params) {
        params = params ? params : {};
        var allowedAttributes = params.keep;
        var reject = params.reject;
        var rejectEvents = params.rejectEvents;
        var rejectAll = false;

        //default reject everything
        if (typeof rejectEvents === 'undefined' && typeof allowedAttributes === 'undefined'){
          rejectAll = true;
        }

        if (typeof reject === 'string') {
          reject = [reject];
        }

        if (typeof allowedAttributes === 'string') {
          allowedAttributes = [allowedAttributes];
        }

        if (reject) {
          reject.forEach(function(name) {
            element.removeAttribute(name);
          });
        }

        Array.prototype.forEach.call(element.attributes, function (attr) {
          if (rejectAll) {
            element.removeAttribute(attr.name);
          }
          else {
            // Reject all except for allowed attributes
            if (allowedAttributes) {
              if (allowedAttributes.indexOf(attr.name) === -1) {
                element.removeAttribute(attr.name);
              }
            }
            else {
              // Or if allowed isn't set, reject /on.+/
              if (rejectEvents) {
                if (attr.name.indexOf('on') === 0 && attr.name.length != 2) {
                  element.removeAttribute(attr.name);
                }
              }
            }
          }
        });
        return element;
      }

      cleanAttributes(card, {keep: 'class', reject: ['id', 'style']});

      function cleanAppChildren (node) {
        if (node.localName.indexOf('app-') !== 0 && ['broadcast', 'listen'].indexOf(node.localName) === -1) {
          node.parentNode.removeChild(node);
        }
        cleanAttributes(node, {rejectEvents: true});
        if (node.children.length > 0) {
          Array.prototype.forEach.call(node.children, cleanAppChildren);
        }
      }

      Array.prototype.forEach.call(card.children, function (section) {
        Array.prototype.forEach.call(section.children, cleanAppChildren);
      });

      function cleanSection (sectionContainer) {
        var listenElements = Array.prototype.slice.call(sectionContainer.querySelectorAll('listen'));
        var broadcastElements = Array.prototype.slice.call(sectionContainer.querySelectorAll('broadcast'));
        var subscriptionElements = listenElements.concat(broadcastElements);

        subscriptionElements.forEach(function (subscriptionElement) {
          subscriptionElement.innerHTML = '';
          if (subscriptionElement.parentNode.localName.indexOf('app-') !== 0) {
            subscriptionElement.parentNode.removeChild(subscriptionElement);
          }
        });

        function cleanComponentElement (componentElement) {
          if (componentElement.localName.indexOf('app-') === 0 || ['broadcast', 'listen'].indexOf(componentElement.localName) > -1){
            Array.prototype.slice.call(componentElement.children).forEach(cleanComponentElement);
          }
          else {
            componentElement.parentNode.removeChild(componentElement);
          }
        }

        Array.prototype.slice.call(sectionContainer.children).forEach(cleanComponentElement);
      }

      ['.fixed-top', '.phone-canvas', '.fixed-bottom'].forEach(function (sectionSelector) {
        cleanSection(card.querySelector(sectionSelector));
      });

      return card;
    };

    this.getPortableAppTree = function () {
      var appContainerClone = this.container.cloneNode(true);
      var cards = appContainerClone.querySelectorAll('.ceci-card');

      Array.prototype.forEach.call(cards, this.getPortableCardTree);

      return appContainerClone;
    };

    // This is clearly a hack, we should just be doing new App(...),
    // but it's too much work to make that right right now.
    this.clear = function () {
      var t = this;
      getUuid(this, function(id){
        t.id = id;
        Ceci.clearCards();
        this.addCard();
      });
    };

    var init = function(id){
      var t = this;
      this.id = id;

      Ceci.load.call(t, function (components) {
        Ceci.convertContainer(t.container, function (element){
          element.setAttribute('id', t.generateTagId(element.tagName.toLowerCase()));
          t.componentAddedCallback(element);
        });

        // run any plugins to be run when the app is finished loading
        Ceci._plugins.onload.forEach(function(plugin) {
          plugin();
        });

        if (typeof params.onload === 'function'){
          params.onload.call(t, components);
        }

        Ceci.currentCard = t.container.querySelector('.ceci-card');
        onLoadListeners.forEach(function(listener) {
          listener(components);
        });
      });
    };

    if (params.id){
      init(params.id);
    } else {
      getUuid(this, init);
    }
  };

  App.onload = function(listener) {
    onLoadListeners.push(listener);
  };

  App.getUuid = getUuid;

  Ceci.App = App;

  return Ceci;
});
