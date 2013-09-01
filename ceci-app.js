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

    var collectComponentsFromContainer = function(container) {
      var elements = [];
      Array.prototype.forEach.call(container.children, function (child) {
        if (child.localName.indexOf('app-') > -1 && typeof child.describe === 'function') {
          elements.push(child.describe());
        }
      });
      return elements;
    };

    this.toJSON = function () {
      var manifest = {
        cards: []
      };

      var cards = $(this.container).find('.ceci-card');



      cards.each(function (index, card) {
        manifest.cards.push({
          top: collectComponentsFromContainer(card.querySelector('.fixed-top')),
          canvas: collectComponentsFromContainer(card.querySelector('.phone-canvas')),
          bottom: collectComponentsFromContainer(card.querySelector('.fixed-bottom'))
        });
      });
      return manifest;
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
      var doc = document.createElement('div');


      var cleanAttributes = function(element, params){
        params = params ? params : {};
        var allowedAttributes = params.keep;
        var reject = params.reject;
        var rejectEvents = params.rejectEvents;
        var rejectAll = false;

        //default reject everything
        if (typeof rejectEvents === 'undefinded' && typeof allowedAttributes === 'undefinded'){
          rejectAll = true;
        }

        if (typeof reject === 'string'){
          reject = [reject];
        }

        if (typeof allowedAttributes === 'string'){
          allowedAttributes = [allowedAttributes];
        }

        if (reject){
          reject.forEach(function(name){
            element.removeAttribute(name);
          });
        }


        Array.prototype.forEach.call(element.attributes, function(attr){
          if (rejectAll){
            element.removeAttribute(attr.name);
          }
          else{
            // Reject all except for allowed attributes
            if (allowedAttributes){
              if (allowedAttributes.indexOf(attr.name) === -1){
                element.removeAttribute(attr.name);
              }
            }
            else{
              // Or if allowed isn't set, reject /on.+/
              if (rejectEvents){
                if (attr.name.indexOf('on') === 0 && attr.name.length != 2){
                  element.removeAttribute(attr.name);
                }
              }
            }
          }
        });
        return element;
      };

      // this actually means "do shallow"
      var shallow = false;

      Array.prototype.forEach.call(this.container.querySelectorAll('.ceci-card'), function(realCard){
        var card = realCard.cloneNode(shallow);
        cleanAttributes(card, {keep: 'class', reject: ['id', 'style']});
        doc.appendChild(card);

        Array.prototype.forEach.call(realCard.children, function(realSection){
          var section = realSection.cloneNode(shallow);

          cleanAttributes(section, {keep: 'class', reject: ['id', 'style']});
          card.appendChild(section);

          Array.prototype.forEach.call(realSection.children, function(component){
            component = Ceci.rehydrateComponent(component.describe());
            section.appendChild(component);
          });
        });
      });

      return doc.innerHTML;
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
