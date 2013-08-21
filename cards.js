/**
 * This library allows component wrapping in "card" elements.
 * (right now these are just divs of class "flathead-card").
 */
define(["ceci"], function(Ceci) {
  var cardClass = "flathead-card",
      cards = [];

  function showCard(card) {
    cards.forEach(function(c) {
      if (c === card) {
        c.style.display = "block";
      } else {
        c.style.display = "none";
      }
    })
  }

  function extend(element, card) {
    console.log("child added: ", element);

    // allow elements to indicate that "their" card needs focus
    element.showCard = function() {
      console.log("shifting focus to ", card);
      showCard(card);
    }
  }

  function observe(card) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type !== "childList")
          return;
        if (mutation.addedNodes) {
          Array.prototype.slice.call(mutation.addedNodes).forEach(function(child) {
            extend(child, card);
          });
        }
      });
    });
    observer.observe(card, { childList: true });

    // also process any already existing cards
    if(card.children.length > 0) {
      var children = Array.prototype.slice.call(card.children);
      children.forEach(function(child) {
        extend(child, card);
      });
    }
  }

  function processCard(card) {
    card.id = cardClass + "-" + (cards.length+1);
    observe(card);
    cards.push(card);
  }

  window.createCard = Ceci.createCard = function() {
  	var card = document.createElement("div");
  	card.setAttribute("class", cardClass);
    processCard(card);
    return card;
  }

  function convertCards() {
    var cardlist = document.querySelectorAll("div[class='"+cardClass+"']");
    if (cardlist.length > 0) {
      cardlist = Array.prototype.slice.call(cardlist);
      cardlist.forEach(function(card) {
        console.log("processing", card);
        processCard(card);
      })
      showCard(cards[0]);
    }
  }

  return {
    load: convertCards
  }
});
