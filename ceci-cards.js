/**
 * This library allows component wrapping in "card" elements.
 * (right now these are just divs of class "ceci-card").
 */
define(["ceci"], function(Ceci) {
  "use strict";

  var cardClass = "ceci-card";
  var cards = [];
  Ceci.currentCard = null;

  function showCard(card) {
    Ceci.showCardCallback(card);
    cards.forEach(function(c) {
      if (c === card) {
        c.style.display = "block";
      } else {
        c.style.display = "none";
      }
    });
    Ceci.currentCard = card;
  }

  function extend(element, card) {
    card.elements.push(element);
    element.card = card;
    element.showCard = function() {
      showCard(card);
    };
  }

  function revert(element, card) {
    card.elements.splice(card.elements.indexOf(element), 1);
    if(element.card === card) {
      delete element.card;
      delete element.showCard;
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
    ["fixed-top", "phone-canvas", "fixed-bottom"].forEach(function(segment) {
      var div = document.createElement("div");
      div.className = segment + " drophere";
      card.appendChild(div);
      observe(div, card);
    });
    card.showCard = function() {
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
  }

  // extend rehydration function for card rehydrating
  (function() {
    var oldFn = Ceci.rehydrate;
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

  var createCard = Ceci.createCard = function() {
    var card = document.createElement("div");
    card.setAttribute("class", cardClass);
    processCard(card);
    return card;
  };

  function convertCards() {
    var cardlist = document.querySelectorAll("div." + cardClass);
    if (cardlist.length > 0) {
      cardlist = Array.prototype.slice.call(cardlist);
      cardlist.forEach(function(card) {
        if(!card.showCard) {
          processCard(card);
        }
      });
      showCard(cards[0]);
    }
  }

  Ceci.registerCeciPlugin("onload", convertCards);

  Ceci.showCardCallback = function(card){};

  var onCardChange = Ceci.onCardChange = function (callback){
    Ceci.showCardCallback = callback;

    // call the card change if we've already done one before it's wired up
    if (Ceci.currentCard){
      callback(Ceci.currentCard);
    }
  };

  return {
    onCardChange: onCardChange,
    load: convertCards,
    createCard: createCard,
    _cards: cards
  };
});
