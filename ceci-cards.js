/**
 * This library allows component wrapping in "card" elements.
 * (right now these are just divs of class "ceci-card").
 */
define(["ceci"], function(Ceci) {
  "use strict";

  var cardClass = "ceci-card";
  var cards = [];
  Ceci.currentCard = null;

  Ceci.clearCards = function(){
    cards.forEach(function(card){

      //TODO: This might be a bit of a heavy-handed approach to this.
      Array.prototype.forEach.call(card.querySelectorAll('*'), function(element){
        if (element.removeSafely){
          element.removeSafely();
        }
      });
      card.remove();
    });
    cards = [];
  };

  function showCard(card) {
    Ceci._showCardCallback(card);
    cards.forEach(function(c) {
      if (c === card) {
        c.style.display = "block";
      } else {
        c.style.display = "none";
      }
    });
    Ceci.currentCard = card;
  }

  Ceci.elementWantsAttention = function(element) {
    showCard(element.parentNode.parentNode);
  };

  function extend(element, card) {
    card.elements.push(element);
    element.card = card;
    element.show = function() {
      showCard(card);
    };
  }

  function revert(element, card) {
    card.elements.splice(card.elements.indexOf(element), 1);
    if(element.card === card) {
      delete element.card;
      delete element.show;
    }
  }

  function observe(container, card) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type !== "childList")
          return;
        if (mutation.addedNodes) {
          Array.prototype.slice.call(mutation.addedNodes).forEach(function(child) {
            extend(child, card);
          });
        }
        else if(mutation.removedNodes) {
          Array.prototype.slice.call(mutation.addedNodes).forEach(function(child) {
            revert(child, card);
          });
        }
      });
    });
    observer.observe(container, { childList: true });

    // also process any already existing cards
    if(container.children.length > 0) {
      var children = Array.prototype.slice.call(container.children);
      children.forEach(function(child) {
        extend(child, card);
      });
    }
  }

  function processCard(card) {
    card.elements = [];
    if(card.children) {
      Array.prototype.slice.call(card.children).forEach(function(child) {
        extend(child, card);
      });
    }
    card.id = card.id || cardClass + "-" + (cards.length+1);

    Array.prototype.forEach.call(card.querySelectorAll('.fixed-top, .phone-canvas, .fixed-bottom'), function(container){
      observe(container, card);
    });

    card.show = function() {
      showCard(card);
    };

    card.describe = function() {
      return {
        id: card.id,
        elements: card.elements.map(function(e) {
          return e.describe();
        })
      };
    };

    cards.push(card);
    Ceci._cardAddedCallback(card);
  }

  // extend rehydration function for card rehydrating
  (function() {
    var oldFn = Ceci.rehydrate;
    Ceci.rehydrateComponent = oldFn;
    Ceci.rehydrate = function(description) {
      var elements = description.elements.map(function(desc) {
        return oldFn(desc);
      });
      var card = document.createElement("div");
      card.setAttribute("class", cardClass);
      card.id = description.id;
      elements.forEach(function(e) {
        card.appendChild(e);
      });
      return card;
    };
  }());

  var createCard = Ceci.createCard = function(container) {
    var card = document.createElement("div");

    var top = document.createElement("div");
    top.classList.add('fixed-top');

    var canvas = document.createElement("div");
    canvas.classList.add('phone-canvas');

    var bottom = document.createElement("div");
    bottom.classList.add('fixed-bottom');

    card.appendChild(top);
    card.appendChild(canvas);
    card.appendChild(bottom);

    card.setAttribute("class", cardClass);
    container.appendChild(card);
    processCard(card);
    return card;
  };

  function convertCards() {
    var cardlist = document.querySelectorAll("div." + cardClass);
    if (cardlist.length > 0) {
      cardlist = Array.prototype.slice.call(cardlist);
      cardlist.forEach(function(card) {
        if(!card.show) {
          processCard(card);
        }
      });
      showCard(cards[0]);
    }
  }

  Ceci.registerCeciPlugin("onload", convertCards);

  // TODO: when cards is instance-based, these should be removed from the global Ceci object
  Ceci._showCardCallback = function(card){};
  Ceci._cardAddedCallback = function(card){
    Ceci.fireChangeEvent();
  };


  var onCardChange = Ceci.onCardChange = function (callback){
    Ceci._showCardCallback = callback;

    // call the card change if we've already done one before it's wired up
    if (Ceci.currentCard){
      callback(Ceci.currentCard);
    }
  };
  var onCardAdded = Ceci.onCardAdded = function (callback){
    Ceci._cardAddedCallback = function(card){
      callback(card);
      Ceci.fireChangeEvent();
    };
  };

  return Ceci;
});
