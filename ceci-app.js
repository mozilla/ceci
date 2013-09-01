/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["jquery", "ceci-cards", "jquery-ui"], function($, Ceci) {
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
    $.get('/store/uuid', function(data) {
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

    this.serialize = function () {
      var manifest = {
        cards: []
      };

      var cards = $(this.container).find('.ceci-card');

      cards.each(function (index, card) {
        var cardManifest = {
          elements: []
        };
        manifest.cards.push(cardManifest);
        var phoneCanvas = card.querySelector('.phone-canvas');
        Array.prototype.forEach.call(phoneCanvas.children, function (child) {
          if (child.localName.indexOf('app-') > -1 && typeof child.describe === 'function') {
            cardManifest.elements.push(child.describe());
          }
        });
      });
      return manifest;
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
    };

    var init = function(id){
      var t = this;
      this.id = id;

      Ceci.load.call(t, function (components) {
        Ceci.convertContainer(t.container, function (element){
          element.setAttribute('id', t.generateTagId(name));
          t.componentAddedCallback(element);
        });

        // run any plugins to be run when the app is finished loading
        Ceci._plugins.onload.forEach(function(plugin) {
          plugin();
        });

        if (typeof params.onload === 'function'){
          params.onload.call(t, components);
        }

        onLoadListeners.forEach(function(listener) {
          listener(components);
        });
      });
    };

    if (params.id){
      //TODO: load from S3
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

  return App;
});
