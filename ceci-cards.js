/**
 * This library allows component wrapping in "card" elements.
 * (right now these are just divs of class "ceci-card").
 */
define(["ceci"], function(Ceci) {
  "use strict";

  var cardClass = "ceci-card",
      cards = [];

  function showCard(card) {
    cards.forEach(function(c) {
      if (c === card) {
        c.style.display = "block";
      } else {
        c.style.display = "none";
      }
    });
  }

  function extend(element, card) {
    element.card = card;
    element.showCard = function() {
      showCard(card);
    };
  }

  function revert(element, card) {
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
    card.id = cardClass + "-" + (cards.length+1);
    ["fixed-top", "phone-canvas", "fixed-bottom"].forEach(function(segment) {
      var div = document.createElement("div");
      div.className = segment + " drophere";
      card.appendChild(div);
      observe(div, card);
    });
    card.showCard = function() {
      showCard(card);
    };
    cards.push(card);
  }

  Ceci.createCard = createCard = function() {
    var card = document.createElement("div");
    card.setAttribute("class", cardClass);
    processCard(card);
    return card;
  };

  function convertCards() {
    var cardlist = document.querySelectorAll("div."+cardClass);
    if (cardlist.length > 0) {
      cardlist = Array.prototype.slice.call(cardlist);
      cardlist.forEach(function(card) {
        processCard(card);
      });
      showCard(cards[0]);
    }
  }

  Ceci.registerCeciPlugin("onload", convertCards);

  return {
    load: convertCards,
    createCard: createCard,
    _cards: cards
  };
});
