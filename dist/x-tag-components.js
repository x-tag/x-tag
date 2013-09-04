// We don't use the platform bootstrapper, so fake this stuff.

window.Platform = {};
var logFlags = {};



// DOMTokenList polyfill fir IE9
(function () {

if (typeof window.Element === "undefined" || "classList" in document.documentElement) return;

var prototype = Array.prototype,
    indexOf = prototype.indexOf,
    slice = prototype.slice,
    push = prototype.push,
    splice = prototype.splice,
    join = prototype.join;

function DOMTokenList(el) {
  this._element = el;
  if (el.className != this._classCache) {
    this._classCache = el.className;

    if (!this._classCache) return;

      // The className needs to be trimmed and split on whitespace
      // to retrieve a list of classes.
      var classes = this._classCache.replace(/^\s+|\s+$/g,'').split(/\s+/),
        i;
    for (i = 0; i < classes.length; i++) {
      push.call(this, classes[i]);
    }
  }
};

function setToClassName(el, classes) {
  el.className = classes.join(' ');
}

DOMTokenList.prototype = {
  add: function(token) {
    if(this.contains(token)) return;
    push.call(this, token);
    setToClassName(this._element, slice.call(this, 0));
  },
  contains: function(token) {
    return indexOf.call(this, token) !== -1;
  },
  item: function(index) {
    return this[index] || null;
  },
  remove: function(token) {
    var i = indexOf.call(this, token);
     if (i === -1) {
       return;
     }
    splice.call(this, i, 1);
    setToClassName(this._element, slice.call(this, 0));
  },
  toString: function() {
    return join.call(this, ' ');
  },
  toggle: function(token) {
    if (indexOf.call(this, token) === -1) {
      this.add(token);
    } else {
      this.remove(token);
    }
  }
};

window.DOMTokenList = DOMTokenList;

function defineElementGetter (obj, prop, getter) {
  if (Object.defineProperty) {
    Object.defineProperty(obj, prop,{
      get : getter
    })
  } else {
    obj.__defineGetter__(prop, getter);
  }
}

defineElementGetter(Element.prototype, 'classList', function () {
  return new DOMTokenList(this);
});

})();


/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

// SideTable is a weak map where possible. If WeakMap is not available the
// association is stored as an expando property.
var SideTable;
// TODO(arv): WeakMap does not allow for Node etc to be keys in Firefox
if (typeof WeakMap !== 'undefined' && navigator.userAgent.indexOf('Firefox/') < 0) {
  SideTable = WeakMap;
} else {
  (function() {
    var defineProperty = Object.defineProperty;
    var hasOwnProperty = Object.hasOwnProperty;
    var counter = new Date().getTime() % 1e9;

    SideTable = function() {
      this.name = '__st' + (Math.random() * 1e9 >>> 0) + (counter++ + '__');
    };

    SideTable.prototype = {
      set: function(key, value) {
        defineProperty(key, this.name, {value: value, writable: true});
      },
      get: function(key) {
        return hasOwnProperty.call(key, this.name) ? key[this.name] : undefined;
      },
      delete: function(key) {
        this.set(key, undefined);
      }
    }
  })();
}

/*
 * Copyright 2012 The Polymer Authors. All rights reserved.
 * Use of this source code is goverened by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(global) {

  var registrationsTable = new SideTable();

  // We use setImmediate or postMessage for our future callback.
  var setImmediate = window.msSetImmediate;

  // Use post message to emulate setImmediate.
  if (!setImmediate) {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener('message', function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
      setImmediateQueue.push(func);
      window.postMessage(sentinel, '*');
    };
  }

  // This is used to ensure that we never schedule 2 callas to setImmediate
  var isScheduled = false;

  // Keep track of observers that needs to be notified next time.
  var scheduledObservers = [];

  /**
   * Schedules |dispatchCallback| to be called in the future.
   * @param {MutationObserver} observer
   */
  function scheduleCallback(observer) {
    scheduledObservers.push(observer);
    if (!isScheduled) {
      isScheduled = true;
      setImmediate(dispatchCallbacks);
    }
  }

  function wrapIfNeeded(node) {
    return window.ShadowDOMPolyfill &&
        window.ShadowDOMPolyfill.wrapIfNeeded(node) ||
        node;
  }

  function dispatchCallbacks() {
    // http://dom.spec.whatwg.org/#mutation-observers

    isScheduled = false; // Used to allow a new setImmediate call above.

    var observers = scheduledObservers;
    scheduledObservers = [];
    // Sort observers based on their creation UID (incremental).
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });

    var anyNonEmpty = false;
    observers.forEach(function(observer) {

      // 2.1, 2.2
      var queue = observer.takeRecords();
      // 2.3. Remove all transient registered observers whose observer is mo.
      removeTransientObserversFor(observer);

      // 2.4
      if (queue.length) {
        observer.callback_(queue, observer);
        anyNonEmpty = true;
      }
    });

    // 3.
    if (anyNonEmpty)
      dispatchCallbacks();
  }

  function removeTransientObserversFor(observer) {
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations)
        return;
      registrations.forEach(function(registration) {
        if (registration.observer === observer)
          registration.removeTransientObservers();
      });
    });
  }

  /**
   * This function is used for the "For each registered observer observer (with
   * observer's options as options) in target's list of registered observers,
   * run these substeps:" and the "For each ancestor ancestor of target, and for
   * each registered observer observer (with options options) in ancestor's list
   * of registered observers, run these substeps:" part of the algorithms. The
   * |options.subtree| is checked to ensure that the callback is called
   * correctly.
   *
   * @param {Node} target
   * @param {function(MutationObserverInit):MutationRecord} callback
   */
  function forEachAncestorAndObserverEnqueueRecord(target, callback) {
    for (var node = target; node; node = node.parentNode) {
      var registrations = registrationsTable.get(node);

      if (registrations) {
        for (var j = 0; j < registrations.length; j++) {
          var registration = registrations[j];
          var options = registration.options;

          // Only target ignores subtree.
          if (node !== target && !options.subtree)
            continue;

          var record = callback(options);
          if (record)
            registration.enqueue(record);
        }
      }
    }
  }

  var uidCounter = 0;

  /**
   * The class that maps to the DOM MutationObserver interface.
   * @param {Function} callback.
   * @constructor
   */
  function JsMutationObserver(callback) {
    this.callback_ = callback;
    this.nodes_ = [];
    this.records_ = [];
    this.uid_ = ++uidCounter;
  }

  JsMutationObserver.prototype = {
    observe: function(target, options) {
      target = wrapIfNeeded(target);

      // 1.1
      if (!options.childList && !options.attributes && !options.characterData ||

          // 1.2
          options.attributeOldValue && !options.attributes ||

          // 1.3
          options.attributeFilter && options.attributeFilter.length &&
              !options.attributes ||

          // 1.4
          options.characterDataOldValue && !options.characterData) {

        throw new SyntaxError();
      }

      var registrations = registrationsTable.get(target);
      if (!registrations)
        registrationsTable.set(target, registrations = []);

      // 2
      // If target's list of registered observers already includes a registered
      // observer associated with the context object, replace that registered
      // observer's options with options.
      var registration;
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].observer === this) {
          registration = registrations[i];
          registration.removeListeners();
          registration.options = options;
          break;
        }
      }

      // 3.
      // Otherwise, add a new registered observer to target's list of registered
      // observers with the context object as the observer and options as the
      // options, and add target to context object's list of nodes on which it
      // is registered.
      if (!registration) {
        registration = new Registration(this, target, options);
        registrations.push(registration);
        this.nodes_.push(target);
      }

      registration.addListeners();
    },

    disconnect: function() {
      this.nodes_.forEach(function(node) {
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          var registration = registrations[i];
          if (registration.observer === this) {
            registration.removeListeners();
            registrations.splice(i, 1);
            // Each node can only have one registered observer associated with
            // this observer.
            break;
          }
        }
      }, this);
      this.records_ = [];
    },

    takeRecords: function() {
      var copyOfRecords = this.records_;
      this.records_ = [];
      return copyOfRecords;
    }
  };

  /**
   * @param {string} type
   * @param {Node} target
   * @constructor
   */
  function MutationRecord(type, target) {
    this.type = type;
    this.target = target;
    this.addedNodes = [];
    this.removedNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
  }

  function copyMutationRecord(original) {
    var record = new MutationRecord(original.type, original.target);
    record.addedNodes = original.addedNodes.slice();
    record.removedNodes = original.removedNodes.slice();
    record.previousSibling = original.previousSibling;
    record.nextSibling = original.nextSibling;
    record.attributeName = original.attributeName;
    record.attributeNamespace = original.attributeNamespace;
    record.oldValue = original.oldValue;
    return record;
  };

  // We keep track of the two (possibly one) records used in a single mutation.
  var currentRecord, recordWithOldValue;

  /**
   * Creates a record without |oldValue| and caches it as |currentRecord| for
   * later use.
   * @param {string} oldValue
   * @return {MutationRecord}
   */
  function getRecord(type, target) {
    return currentRecord = new MutationRecord(type, target);
  }

  /**
   * Gets or creates a record with |oldValue| based in the |currentRecord|
   * @param {string} oldValue
   * @return {MutationRecord}
   */
  function getRecordWithOldValue(oldValue) {
    if (recordWithOldValue)
      return recordWithOldValue;
    recordWithOldValue = copyMutationRecord(currentRecord);
    recordWithOldValue.oldValue = oldValue;
    return recordWithOldValue;
  }

  function clearRecords() {
    currentRecord = recordWithOldValue = undefined;
  }

  /**
   * @param {MutationRecord} record
   * @return {boolean} Whether the record represents a record from the current
   * mutation event.
   */
  function recordRepresentsCurrentMutation(record) {
    return record === recordWithOldValue || record === currentRecord;
  }

  /**
   * Selects which record, if any, to replace the last record in the queue.
   * This returns |null| if no record should be replaced.
   *
   * @param {MutationRecord} lastRecord
   * @param {MutationRecord} newRecord
   * @param {MutationRecord}
   */
  function selectRecord(lastRecord, newRecord) {
    if (lastRecord === newRecord)
      return lastRecord;

    // Check if the the record we are adding represents the same record. If
    // so, we keep the one with the oldValue in it.
    if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord))
      return recordWithOldValue;

    return null;
  }

  /**
   * Class used to represent a registered observer.
   * @param {MutationObserver} observer
   * @param {Node} target
   * @param {MutationObserverInit} options
   * @constructor
   */
  function Registration(observer, target, options) {
    this.observer = observer;
    this.target = target;
    this.options = options;
    this.transientObservedNodes = [];
  }

  Registration.prototype = {
    enqueue: function(record) {
      var records = this.observer.records_;
      var length = records.length;

      // There are cases where we replace the last record with the new record.
      // For example if the record represents the same mutation we need to use
      // the one with the oldValue. If we get same record (this can happen as we
      // walk up the tree) we ignore the new record.
      if (records.length > 0) {
        var lastRecord = records[length - 1];
        var recordToReplaceLast = selectRecord(lastRecord, record);
        if (recordToReplaceLast) {
          records[length - 1] = recordToReplaceLast;
          return;
        }
      } else {
        scheduleCallback(this.observer);
      }

      records[length] = record;
    },

    addListeners: function() {
      this.addListeners_(this.target);
    },

    addListeners_: function(node) {
      var options = this.options;
      if (options.attributes)
        node.addEventListener('DOMAttrModified', this, true);

      if (options.characterData)
        node.addEventListener('DOMCharacterDataModified', this, true);

      if (options.childList)
        node.addEventListener('DOMNodeInserted', this, true);

      if (options.childList || options.subtree)
        node.addEventListener('DOMNodeRemoved', this, true);
    },

    removeListeners: function() {
      this.removeListeners_(this.target);
    },

    removeListeners_: function(node) {
      var options = this.options;
      if (options.attributes)
        node.removeEventListener('DOMAttrModified', this, true);

      if (options.characterData)
        node.removeEventListener('DOMCharacterDataModified', this, true);

      if (options.childList)
        node.removeEventListener('DOMNodeInserted', this, true);

      if (options.childList || options.subtree)
        node.removeEventListener('DOMNodeRemoved', this, true);
    },

    /**
     * Adds a transient observer on node. The transient observer gets removed
     * next time we deliver the change records.
     * @param {Node} node
     */
    addTransientObserver: function(node) {
      // Don't add transient observers on the target itself. We already have all
      // the required listeners set up on the target.
      if (node === this.target)
        return;

      this.addListeners_(node);
      this.transientObservedNodes.push(node);
      var registrations = registrationsTable.get(node);
      if (!registrations)
        registrationsTable.set(node, registrations = []);

      // We know that registrations does not contain this because we already
      // checked if node === this.target.
      registrations.push(this);
    },

    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];

      transientObservedNodes.forEach(function(node) {
        // Transient observers are never added to the target.
        this.removeListeners_(node);

        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          if (registrations[i] === this) {
            registrations.splice(i, 1);
            // Each node can only have one registered observer associated with
            // this observer.
            break;
          }
        }
      }, this);
    },

    handleEvent: function(e) {
      // Stop propagation since we are managing the propagation manually.
      // This means that other mutation events on the page will not work
      // correctly but that is by design.
      e.stopImmediatePropagation();

      switch (e.type) {
        case 'DOMAttrModified':
          // http://dom.spec.whatwg.org/#concept-mo-queue-attributes

          var name = e.attrName;
          var namespace = e.relatedNode.namespaceURI;
          var target = e.target;

          // 1.
          var record = new getRecord('attributes', target);
          record.attributeName = name;
          record.attributeNamespace = namespace;

          // 2.
          var oldValue =
              e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;

          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
            // 3.1, 4.2
            if (!options.attributes)
              return;

            // 3.2, 4.3
            if (options.attributeFilter && options.attributeFilter.length &&
                options.attributeFilter.indexOf(name) === -1 &&
                options.attributeFilter.indexOf(namespace) === -1) {
              return;
            }
            // 3.3, 4.4
            if (options.attributeOldValue)
              return getRecordWithOldValue(oldValue);

            // 3.4, 4.5
            return record;
          });

          break;

        case 'DOMCharacterDataModified':
          // http://dom.spec.whatwg.org/#concept-mo-queue-characterdata
          var target = e.target;

          // 1.
          var record = getRecord('characterData', target);

          // 2.
          var oldValue = e.prevValue;


          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
            // 3.1, 4.2
            if (!options.characterData)
              return;

            // 3.2, 4.3
            if (options.characterDataOldValue)
              return getRecordWithOldValue(oldValue);

            // 3.3, 4.4
            return record;
          });

          break;

        case 'DOMNodeRemoved':
          this.addTransientObserver(e.target);
          // Fall through.
        case 'DOMNodeInserted':
          // http://dom.spec.whatwg.org/#concept-mo-queue-childlist
          var target = e.relatedNode;
          var changedNode = e.target;
          var addedNodes, removedNodes;
          if (e.type === 'DOMNodeInserted') {
            addedNodes = [changedNode];
            removedNodes = [];
          } else {

            addedNodes = [];
            removedNodes = [changedNode];
          }
          var previousSibling = changedNode.previousSibling;
          var nextSibling = changedNode.nextSibling;

          // 1.
          var record = getRecord('childList', target);
          record.addedNodes = addedNodes;
          record.removedNodes = removedNodes;
          record.previousSibling = previousSibling;
          record.nextSibling = nextSibling;

          forEachAncestorAndObserverEnqueueRecord(target, function(options) {
            // 2.1, 3.2
            if (!options.childList)
              return;

            // 2.2, 3.3
            return record;
          });

      }

      clearRecords();
    }
  };

  global.JsMutationObserver = JsMutationObserver;

})(this);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

if (!window.MutationObserver) {
  window.MutationObserver = 
      window.WebKitMutationObserver || 
      window.JsMutationObserver;
  if (!MutationObserver) {
    throw new Error("no mutation observer support");
  }
}

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

/**
 * Implements `document.register`
 * @module CustomElements
*/

/**
 * Polyfilled extensions to the `document` object.
 * @class Document
*/

(function(scope) {

if (!scope) {
  scope = window.CustomElements = {flags:{}};
}

// native document.register?

scope.hasNative = (document.webkitRegister || document.register) && scope.flags.register === 'native';
if (scope.hasNative) {

  // normalize
  document.register = document.register || document.webkitRegister;

  var nop = function() {};

  // exports
  scope.registry = {};
  scope.upgradeElement = nop;

} else {

/**
 * Registers a custom tag name with the document.
 *
 * When a registered element is created, a `readyCallback` method is called
 * in the scope of the element. The `readyCallback` method can be specified on
 * either `inOptions.prototype` or `inOptions.lifecycle` with the latter taking
 * precedence.
 *
 * @method register
 * @param {String} inName The tag name to register. Must include a dash ('-'),
 *    for example 'x-component'.
 * @param {Object} inOptions
 *    @param {String} [inOptions.extends]
 *      (_off spec_) Tag name of an element to extend (or blank for a new
 *      element). This parameter is not part of the specification, but instead
 *      is a hint for the polyfill because the extendee is difficult to infer.
 *      Remember that the input prototype must chain to the extended element's
 *      prototype (or HTMLElement.prototype) regardless of the value of
 *      `extends`.
 *    @param {Object} inOptions.prototype The prototype to use for the new
 *      element. The prototype must inherit from HTMLElement.
 *    @param {Object} [inOptions.lifecycle]
 *      Callbacks that fire at important phases in the life of the custom
 *      element.
 *
 * @example
 *      FancyButton = document.register("fancy-button", {
 *        extends: 'button',
 *        prototype: Object.create(HTMLButtonElement.prototype, {
 *          readyCallback: {
 *            value: function() {
 *              console.log("a fancy-button was created",
 *            }
 *          }
 *        })
 *      });
 * @return {Function} Constructor for the newly registered type.
 */
function register(inName, inOptions) {
  //console.warn('document.register("' + inName + '", ', inOptions, ')');
  // construct a defintion out of options
  // TODO(sjmiles): probably should clone inOptions instead of mutating it
  var definition = inOptions || {};
  if (!inName) {
    // TODO(sjmiles): replace with more appropriate error (Erik can probably
    // offer guidance)
    throw new Error('Name argument must not be empty');
  }
  // record name
  definition.name = inName;
  // must have a prototype, default to an extension of HTMLElement
  // TODO(sjmiles): probably should throw if no prototype, check spec
  if (!definition.prototype) {
    // TODO(sjmiles): replace with more appropriate error (Erik can probably
    // offer guidance)
    throw new Error('Options missing required prototype property');
  }
  // ensure a lifecycle object so we don't have to null test it
  definition.lifecycle = definition.lifecycle || {};
  // build a list of ancestral custom elements (for native base detection)
  // TODO(sjmiles): we used to need to store this, but current code only
  // uses it in 'resolveTagName': it should probably be inlined
  definition.ancestry = ancestry(definition.extends);
  // extensions of native specializations of HTMLElement require localName
  // to remain native, and use secondary 'is' specifier for extension type
  resolveTagName(definition);
  // some platforms require modifications to the user-supplied prototype
  // chain
  resolvePrototypeChain(definition);
  // overrides to implement attributeChanged callback
  overrideAttributeApi(definition.prototype);
  // 7.1.5: Register the DEFINITION with DOCUMENT
  registerDefinition(inName, definition);
  // 7.1.7. Run custom element constructor generation algorithm with PROTOTYPE
  // 7.1.8. Return the output of the previous step.
  definition.ctor = generateConstructor(definition);
  definition.ctor.prototype = definition.prototype;
  // force our .constructor to be our actual constructor
  definition.prototype.constructor = definition.ctor;
  // if initial parsing is complete
  if (scope.ready) {
    // upgrade any pre-existing nodes of this type
    scope.upgradeAll(document);
  }
  return definition.ctor;
}

function ancestry(inExtends) {
  var extendee = registry[inExtends];
  if (extendee) {
    return ancestry(extendee.extends).concat([extendee]);
  }
  return [];
}

function resolveTagName(inDefinition) {
  // if we are explicitly extending something, that thing is our
  // baseTag, unless it represents a custom component
  var baseTag = inDefinition.extends;
  // if our ancestry includes custom components, we only have a
  // baseTag if one of them does
  for (var i=0, a; (a=inDefinition.ancestry[i]); i++) {
    baseTag = a.is && a.tag;
  }
  // our tag is our baseTag, if it exists, and otherwise just our name
  inDefinition.tag = baseTag || inDefinition.name;
  if (baseTag) {
    // if there is a base tag, use secondary 'is' specifier
    inDefinition.is = inDefinition.name;
  }
}

function resolvePrototypeChain(inDefinition) {
  // if we don't support __proto__ we need to locate the native level
  // prototype for precise mixing in
  if (!Object.__proto__) {
    // default prototype
    var native = HTMLElement.prototype;
    // work out prototype when using type-extension
    if (inDefinition.is) {
      var inst = document.createElement(inDefinition.tag);
      native = Object.getPrototypeOf(inst);
    }
  }
  // cache this in case of mixin
  inDefinition.native = native;
}

// SECTION 4

function instantiate(inDefinition) {
  // 4.a.1. Create a new object that implements PROTOTYPE
  // 4.a.2. Let ELEMENT by this new object
  //
  // the custom element instantiation algorithm must also ensure that the
  // output is a valid DOM element with the proper wrapper in place.
  //
  return upgrade(domCreateElement(inDefinition.tag), inDefinition);
}

function upgrade(inElement, inDefinition) {
  // some definitions specify an 'is' attribute
  if (inDefinition.is) {
    inElement.setAttribute('is', inDefinition.is);
  }
  // make 'element' implement inDefinition.prototype
  implement(inElement, inDefinition);
  // flag as upgraded
  inElement.__upgraded__ = true;
  // there should never be a shadow root on inElement at this point
  // we require child nodes be upgraded before ready
  scope.upgradeSubtree(inElement);
  // lifecycle management
  ready(inElement);
  // OUTPUT
  return inElement;
}

function implement(inElement, inDefinition) {
  // prototype swizzling is best
  if (Object.__proto__) {
    inElement.__proto__ = inDefinition.prototype;
  } else {
    // where above we can re-acquire inPrototype via
    // getPrototypeOf(Element), we cannot do so when
    // we use mixin, so we install a magic reference
    customMixin(inElement, inDefinition.prototype, inDefinition.native);
    inElement.__proto__ = inDefinition.prototype;
  }
}

function customMixin(inTarget, inSrc, inNative) {
  // TODO(sjmiles): 'used' allows us to only copy the 'youngest' version of
  // any property. This set should be precalculated. We also need to
  // consider this for supporting 'super'.
  var used = {};
  // start with inSrc
  var p = inSrc;
  // sometimes the default is HTMLUnknownElement.prototype instead of
  // HTMLElement.prototype, so we add a test
  // the idea is to avoid mixing in native prototypes, so adding
  // the second test is WLOG
  while (p !== inNative && p !== HTMLUnknownElement.prototype) {
    var keys = Object.getOwnPropertyNames(p);
    for (var i=0, k; k=keys[i]; i++) {
      if (!used[k]) {
        Object.defineProperty(inTarget, k,
            Object.getOwnPropertyDescriptor(p, k));
        used[k] = 1;
      }
    }
    p = Object.getPrototypeOf(p);
  }
}

function ready(inElement) {
  // invoke readyCallback
  if (inElement.readyCallback) {
    inElement.readyCallback();
  }
}

// attribute watching

function overrideAttributeApi(prototype) {
  // overrides to implement callbacks
  // TODO(sjmiles): should support access via .attributes NamedNodeMap
  // TODO(sjmiles): preserves user defined overrides, if any
  var setAttribute = prototype.setAttribute;
  prototype.setAttribute = function(name, value) {
    changeAttribute.call(this, name, value, setAttribute);
  }
  var removeAttribute = prototype.removeAttribute;
  prototype.removeAttribute = function(name, value) {
    changeAttribute.call(this, name, value, removeAttribute);
  }
}

function changeAttribute(name, value, operation) {
  var oldValue = this.getAttribute(name);
  operation.apply(this, arguments);
  if (this.attributeChangedCallback 
      && (this.getAttribute(name) !== oldValue)) {
    this.attributeChangedCallback(name, oldValue);
  }
}

// element registry (maps tag names to definitions)

var registry = {};

function registerDefinition(inName, inDefinition) {
  registry[inName] = inDefinition;
}

function generateConstructor(inDefinition) {
  return function() {
    return instantiate(inDefinition);
  };
}

function createElement(inTag) {
  var definition = registry[inTag];
  if (definition) {
    return new definition.ctor();
  }
  return domCreateElement(inTag);
}

function upgradeElement(inElement) {
  if (!inElement.__upgraded__ && (inElement.nodeType === Node.ELEMENT_NODE)) {
    var type = inElement.getAttribute('is') || inElement.localName;
    var definition = registry[type];
    return definition && upgrade(inElement, definition);
  }
}

function cloneNode(deep) {
  // call original clone
  var n = domCloneNode.call(this, deep);
  // upgrade the element and subtree
  scope.upgradeAll(n);
  return n;
}
// capture native createElement before we override it

var domCreateElement = document.createElement.bind(document);

// capture native cloneNode before we override it

var domCloneNode = Node.prototype.cloneNode;

// exports

document.register = register;
document.createElement = createElement; // override
Node.prototype.cloneNode = cloneNode; // override

scope.registry = registry;

/**
 * Upgrade an element to a custom element. Upgrading an element
 * causes the custom prototype to be applied, an `is` attribute 
 * to be attached (as needed), and invocation of the `readyCallback`.
 * `upgrade` does nothing if the element is already upgraded, or
 * if it matches no registered custom tag name.
 *
 * @method ugprade
 * @param {Element} inElement The element to upgrade.
 * @return {Element} The upgraded element.
 */
scope.upgrade = upgradeElement;

}

})(window.CustomElements);

 /*
Copyright 2013 The Polymer Authors. All rights reserved.
Use of this source code is governed by a BSD-style
license that can be found in the LICENSE file.
*/

(function(scope){

/*
if (HTMLElement.prototype.webkitShadowRoot) {
  Object.defineProperty(HTMLElement.prototype, 'shadowRoot', {
    get: function() {
      return this.webkitShadowRoot;
    }
  };
}
*/

// walk the subtree rooted at node, applying 'find(element, data)' function 
// to each element
// if 'find' returns true for 'element', do not search element's subtree  
function findAll(node, find, data) {
  var e = node.firstElementChild;
  if (!e) {
    e = node.firstChild;
    while (e && e.nodeType !== Node.ELEMENT_NODE) {
      e = e.nextSibling;
    }
  }
  while (e) {
    if (find(e, data) !== true) {
      findAll(e, find, data);
    }
    e = e.nextElementSibling;
  }
  return null;
}

// walk the subtree rooted at node, including descent into shadow-roots, 
// applying 'cb' to each element
function forSubtree(node, cb) {
  //logFlags.dom && node.childNodes && node.childNodes.length && console.group('subTree: ', node);
  findAll(node, function(e) {
    if (cb(e)) {
      return true;
    }
    if (e.webkitShadowRoot) {
      forSubtree(e.webkitShadowRoot, cb);
    }
  });
  if (node.webkitShadowRoot) {
    forSubtree(node.webkitShadowRoot, cb);
  }
  //logFlags.dom && node.childNodes && node.childNodes.length && console.groupEnd();
}

// manage lifecycle on added node
function added(node) {
  if (upgrade(node)) {
    insertedNode(node);
    return true; 
  }
  inserted(node);
}

// manage lifecycle on added node's subtree only
function addedSubtree(node) {
  forSubtree(node, function(e) {
    if (added(e)) {
      return true; 
    }
  });
}

// manage lifecycle on added node and it's subtree
function addedNode(node) {
  return added(node) || addedSubtree(node);
}

// upgrade custom elements at node, if applicable
function upgrade(node) {
  if (!node.__upgraded__ && node.nodeType === Node.ELEMENT_NODE) {
    var type = node.getAttribute('is') || node.localName;
    var definition = scope.registry[type];
    if (definition) {
      logFlags.dom && console.group('upgrade:', node.localName);
      scope.upgrade(node);
      logFlags.dom && console.groupEnd();
      return true;
    }
  }
}

function insertedNode(node) {
  inserted(node);
  if (inDocument(node)) {
    forSubtree(node, function(e) {
      inserted(e);
    });
  }
}

// TODO(sjmiles): if there are descents into trees that can never have inDocument(*) true, fix this

function inserted(element) {
  // TODO(sjmiles): it's possible we were inserted and removed in the space
  // of one microtask, in which case we won't be 'inDocument' here
  // But there are other cases where we are testing for inserted without
  // specific knowledge of mutations, and must test 'inDocument' to determine
  // whether to call inserted
  // If we can factor these cases into separate code paths we can have
  // better diagnostics.
  // TODO(sjmiles): when logging, do work on all custom elements so we can
  // track behavior even when callbacks not defined
  //console.log('inserted: ', element.localName);
  if (element.insertedCallback || (element.__upgraded__ && logFlags.dom)) {
    logFlags.dom && console.group('inserted:', element.localName);
    if (inDocument(element)) {
      element.__inserted = (element.__inserted || 0) + 1;
      // if we are in a 'removed' state, bluntly adjust to an 'inserted' state
      if (element.__inserted < 1) {
        element.__inserted = 1;
      }
      // if we are 'over inserted', squelch the callback
      if (element.__inserted > 1) {
        logFlags.dom && console.warn('inserted:', element.localName,
          'insert/remove count:', element.__inserted)
      } else if (element.insertedCallback) {
        logFlags.dom && console.log('inserted:', element.localName);
        element.insertedCallback();
      }
    }
    logFlags.dom && console.groupEnd();
  }
}

function removedNode(node) {
  removed(node);
  forSubtree(node, function(e) {
    removed(e);
  });
}

function removed(element) {
  // TODO(sjmiles): temporary: do work on all custom elements so we can track
  // behavior even when callbacks not defined
  if (element.removedCallback || (element.__upgraded__ && logFlags.dom)) {
    logFlags.dom && console.log('removed:', element.localName);
    if (!inDocument(element)) {
      element.__inserted = (element.__inserted || 0) - 1;
      // if we are in a 'inserted' state, bluntly adjust to an 'removed' state
      if (element.__inserted > 0) {
        element.__inserted = 0;
      }
      // if we are 'over removed', squelch the callback
      if (element.__inserted < 0) {
        logFlags.dom && console.warn('removed:', element.localName,
            'insert/remove count:', element.__inserted)
      } else if (element.removedCallback) {
        element.removedCallback();
      }
    }
  }
}

function inDocument(element) {
  var p = element;
  while (p) {
    if (p == element.ownerDocument) {
      return true;
    }
    p = p.parentNode || p.host;
  }
}

function watchShadow(node) {
  if (node.webkitShadowRoot && !node.webkitShadowRoot.__watched) {
    logFlags.dom && console.log('watching shadow-root for: ', node.localName);
    observe(node.webkitShadowRoot);
    node.webkitShadowRoot.__watched = true;
  }
}

function watchAllShadows(node) {
  watchShadow(node);
  forSubtree(node, function(e) {
    watchShadow(node);
  });
}

function filter(inNode) {
  switch (inNode.localName) {
    case 'style':
    case 'script':
    case 'template':
    case undefined:
      return true;
  }
}

function handler(mutations) {
  //
  if (logFlags.dom) {
    var mx = mutations[0];
    if (mx && mx.type === 'childList' && mx.addedNodes) {
        if (mx.addedNodes) {
          var d = mx.addedNodes[0];
          while (d && d !== document && !d.host) {
            d = d.parentNode;
          }
          var u = d && (d.URL || d._URL || (d.host && d.host.localName)) || '';
          u = u.split('/?').shift().split('/').pop();
        }
    }
    console.group('mutations (%d) [%s]', mutations.length, u || '');
  }
  //
  mutations.forEach(function(mx) {
    //logFlags.dom && console.group('mutation');
    if (mx.type === 'childList') {
      forEach(mx.addedNodes, function(n) {
        //logFlags.dom && console.log(n.localName);
        if (filter(n)) {
          return;
        }
        // watch shadow-roots on nodes that have had them attached manually
        // TODO(sjmiles): remove if createShadowRoot is overridden
        // TODO(sjmiles): removed as an optimization, manual shadow roots
        // must be watched explicitly
        //watchAllShadows(n);
        // nodes added may need lifecycle management
        addedNode(n);
      });
      // removed nodes may need lifecycle management
      forEach(mx.removedNodes, function(n) {
        //logFlags.dom && console.log(n.localName);
        if (filter(n)) {
          return;
        }
        removedNode(n);
      });
    }
    //logFlags.dom && console.groupEnd();
  });
  logFlags.dom && console.groupEnd();
};

var observer = new MutationObserver(handler);

function takeRecords() {
  // TODO(sjmiles): ask Raf why we have to call handler ourselves
  handler(observer.takeRecords());
}

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

function observe(inRoot) {
  observer.observe(inRoot, {childList: true, subtree: true});
}

function observeDocument(document) {
  observe(document);
}

function upgradeDocument(document) {
  logFlags.dom && console.group('upgradeDocument: ', (document.URL || document._URL || '').split('/').pop());
  addedNode(document);
  logFlags.dom && console.groupEnd();
}

// exports

scope.watchShadow = watchShadow;
scope.watchAllShadows = watchAllShadows;

scope.upgradeAll = addedNode;
scope.upgradeSubtree = addedSubtree;

scope.observeDocument = observeDocument;
scope.upgradeDocument = upgradeDocument;

scope.takeRecords = takeRecords;

})(window.CustomElements);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(){

var HTMLElementElement = function(inElement) {
  inElement.register = HTMLElementElement.prototype.register;
  parseElementElement(inElement);
  return inElement;
};

HTMLElementElement.prototype = {
  register: function(inMore) {
    if (inMore) {
      this.options.lifecycle = inMore.lifecycle;
      if (inMore.prototype) {
        mixin(this.options.prototype, inMore.prototype);
      }
    }
  }
};

function parseElementElement(inElement) {
  // options to glean from inElement attributes
  var options = {
    name: '',
    extends: null
  };
  // glean them
  takeAttributes(inElement, options);
  // default base
  var base = HTMLElement.prototype;
  // optional specified base
  if (options.extends) {
    // build an instance of options.extends
    var archetype = document.createElement(options.extends);
    // acquire the prototype
    // TODO(sjmiles): __proto__ may be hinted by the custom element
    // system on platforms that don't support native __proto__
    // on those platforms the API is mixed into archetype and the
    // effective base is not archetype's real prototype
    base = archetype.__proto__ || Object.getPrototypeOf(archetype);
  }
  // extend base
  options.prototype = Object.create(base);
  // install options
  inElement.options = options;
  // locate user script
  var script = inElement.querySelector('script:not([type]),script[type="text/javascript"],scripts');
  if (script) {
    // execute user script in 'inElement' context
    executeComponentScript(script.textContent, inElement, options.name);
  };
  // register our new element
  var ctor = document.register(options.name, options);
  inElement.ctor = ctor;
  // store optional constructor reference
  var refName = inElement.getAttribute('constructor');
  if (refName) {
    window[refName] = ctor;
  }
}

// each property in inDictionary takes a value
// from the matching attribute in inElement, if any
function takeAttributes(inElement, inDictionary) {
  for (var n in inDictionary) {
    var a = inElement.attributes[n];
    if (a) {
      inDictionary[n] = a.value;
    }
  }
}

// invoke inScript in inContext scope
function executeComponentScript(inScript, inContext, inName) {
  // set (highlander) context
  context = inContext;
  // source location
  var owner = context.ownerDocument;
  var url = (owner._URL || owner.URL || owner.impl
      && (owner.impl._URL || owner.impl.URL));
  // ensure the component has a unique source map so it can be debugged
  // if the name matches the filename part of the owning document's url,
  // use this, otherwise, add ":<name>" to the document url.
  var match = url.match(/.*\/([^.]*)[.]?.*$/);
  if (match) {
    var name = match[1];
    url += name != inName ? ':' + inName : '';
  }
  // compose script
  var code = "__componentScript('"
    + inName
    + "', function(){"
    + inScript
    + "});"
    + "\n//# sourceURL=" + url + "\n"
  ;
  // inject script
  eval(code);
}

var context;

// global necessary for script injection
window.__componentScript = function(inName, inFunc) {
  inFunc.call(context);
};

// utility

// copy top level properties from props to obj
function mixin(obj, props) {
  obj = obj || {};
  try {
    Object.getOwnPropertyNames(props).forEach(function(n) {
      var pd = Object.getOwnPropertyDescriptor(props, n);
      if (pd) {
        Object.defineProperty(obj, n, pd);
      }
    });
  } catch(x) {
  }
  return obj;
}

// exports

window.HTMLElementElement = HTMLElementElement;

})();

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

if (!scope) {
  scope = window.HTMLImports = {flags:{}};
}

// imports

var xhr = scope.xhr;

// importer

var IMPORT_LINK_TYPE = 'import';
var STYLE_LINK_TYPE = 'stylesheet';

// highlander object represents a primary document (the argument to 'load')
// at the root of a tree of documents

// for any document, importer:
// - loads any linked documents (with deduping), modifies paths and feeds them back into importer
// - loads text of external script tags
// - loads text of external style tags inside of <element>, modifies paths

// when importer 'modifies paths' in a document, this includes
// - href/src/action in node attributes
// - paths in inline stylesheets
// - all content inside templates

// linked style sheets in an import have their own path fixed up when their containing import modifies paths
// linked style sheets in an <element> are loaded, and the content gets path fixups
// inline style sheets get path fixups when their containing import modifies paths

var importer = {
  documents: {},
  cache: {},
  preloadSelectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'element link[rel=' + STYLE_LINK_TYPE + ']',
    'template',
    'script[src]',
    'script:not([type])',
    'script[type="text/javascript"]'
  ].join(','),
  loader: function(inNext) {
    // construct a loader instance
    loader = new Loader(importer.loaded, inNext);
    // alias the loader cache (for debugging)
    loader.cache = importer.cache;
    return loader;
  },
  load: function(inDocument, inNext) {
    // construct a loader instance
    loader = importer.loader(inNext);
    // add nodes from document into loader queue
    importer.preload(inDocument);
  },
  preload: function(inDocument) {
    // all preloadable nodes in inDocument
    var nodes = inDocument.querySelectorAll(importer.preloadSelectors);
    // from the main document, only load imports
    // TODO(sjmiles): do this by altering the selector list instead
    nodes = this.filterMainDocumentNodes(inDocument, nodes);
    // extra link nodes from templates, filter templates out of the nodes list
    nodes = this.extractTemplateNodes(nodes);
    // add these nodes to loader's queue
    loader.addNodes(nodes);
  },
  filterMainDocumentNodes: function(inDocument, nodes) {
    if (inDocument === document) {
      nodes = Array.prototype.filter.call(nodes, function(n) {
        return !isScript(n);
      });
    }
    return nodes;
  },
  extractTemplateNodes: function(nodes) {
    var extra = [];
    nodes = Array.prototype.filter.call(nodes, function(n) {
      if (n.localName === 'template') {
        if (n.content) {
          var l$ = n.content.querySelectorAll('link[rel=' + STYLE_LINK_TYPE +
            ']');
          if (l$.length) {
            extra = extra.concat(Array.prototype.slice.call(l$, 0));
          }
        }
        return false;
      }
      return true;
    });
    if (extra.length) {
      nodes = nodes.concat(extra);
    }
    return nodes;
  },
  loaded: function(url, elt, resource) {
    if (isDocumentLink(elt)) {
      var document = importer.documents[url];
      // if we've never seen a document at this url
      if (!document) {
        // generate an HTMLDocument from data
        document = makeDocument(resource, url);
        // resolve resource paths relative to host document
        path.resolvePathsInHTML(document.body);
        // cache document
        importer.documents[url] = document;
        // add nodes from this document to the loader queue
        importer.preload(document);
      }
      // store import record
      elt.import = {
        href: url,
        ownerNode: elt,
        content: document
      };
      // store document resource
      elt.content = resource = document;
    }
    // store generic resource
    // TODO(sorvell): fails for nodes inside <template>.content
    // see https://code.google.com/p/chromium/issues/detail?id=249381.
    elt.__resource = resource;
    // css path fixups
    if (isStylesheetLink(elt)) {
      path.resolvePathsInStylesheet(elt);
    }
  }
};

function isDocumentLink(elt) {
  return isLinkRel(elt, IMPORT_LINK_TYPE);
}

function isStylesheetLink(elt) {
  return isLinkRel(elt, STYLE_LINK_TYPE);
}

function isLinkRel(elt, rel) {
  return elt.localName === 'link' && elt.getAttribute('rel') === rel;
}

function isScript(elt) {
  return elt.localName === 'script';
}

function makeDocument(inHTML, inUrl) {
  // create a new HTML document
  var doc = document.implementation.createHTMLDocument(IMPORT_LINK_TYPE);
  // cache the new document's source url
  doc._URL = inUrl;
  // establish a relative path via <base>
  var base = doc.createElement('base');
  base.setAttribute('href', document.baseURI);
  doc.head.appendChild(base);
  // install html
  doc.body.innerHTML = inHTML;
  // TODO(sorvell): MDV Polyfill intrusion: boostrap template polyfill
  if (window.HTMLTemplateElement && HTMLTemplateElement.bootstrap) {
    HTMLTemplateElement.bootstrap(doc);
  }
  return doc;
}

var loader;

var Loader = function(inOnLoad, inOnComplete) {
  this.onload = inOnLoad;
  this.oncomplete = inOnComplete;
  this.inflight = 0;
  this.pending = {};
  this.cache = {};
};

Loader.prototype = {
  addNodes: function(inNodes) {
    // number of transactions to complete
    this.inflight += inNodes.length;
    // commence transactions
    forEach(inNodes, this.require, this);
    // anything to do?
    this.checkDone();
  },
  require: function(inElt) {
    var url = path.nodeUrl(inElt);
    // TODO(sjmiles): ad-hoc
    inElt.__nodeUrl = url;
    // deduplication
    if (!this.dedupe(url, inElt)) {
      // fetch this resource
      this.fetch(url, inElt);
    }
  },
  dedupe: function(inUrl, inElt) {
    if (this.pending[inUrl]) {
      // add to list of nodes waiting for inUrl
      this.pending[inUrl].push(inElt);
      // don't need fetch
      return true;
    }
    if (this.cache[inUrl]) {
      // complete load using cache data
      this.onload(inUrl, inElt, loader.cache[inUrl]);
      // finished this transaction
      this.tail();
      // don't need fetch
      return true;
    }
    // first node waiting for inUrl
    this.pending[inUrl] = [inElt];
    // need fetch (not a dupe)
    return false;
  },
  fetch: function(url, elt) {
    var receiveXhr = function(err, resource) {
      this.receive(url, elt, err, resource);
    }.bind(this);
    xhr.load(url, receiveXhr);
  },
  receive: function(inUrl, inElt, inErr, inResource) {
    if (!inErr) {
      loader.cache[inUrl] = inResource;
    }
    loader.pending[inUrl].forEach(function(e) {
      if (!inErr) {
        this.onload(inUrl, e, inResource);
      }
      this.tail();
    }, this);
    loader.pending[inUrl] = null;
  },
  tail: function() {
    --this.inflight;
    this.checkDone();
  },
  checkDone: function() {
    if (!this.inflight) {
      this.oncomplete();
    }
  }
};

var URL_ATTRS = ['href', 'src', 'action'];
var URL_ATTRS_SELECTOR = '[' + URL_ATTRS.join('],[') + ']';
var URL_TEMPLATE_SEARCH = '{{.*}}';

var path = {
  nodeUrl: function(inNode) {
    return path.resolveUrl(path.getDocumentUrl(document), path.hrefOrSrc(inNode));
  },
  hrefOrSrc: function(inNode) {
    return inNode.getAttribute("href") || inNode.getAttribute("src");
  },
  documentUrlFromNode: function(inNode) {
    return path.getDocumentUrl(inNode.ownerDocument);
  },
  getDocumentUrl: function(inDocument) {
    var url = inDocument &&
        // TODO(sjmiles): ShadowDOMPolyfill intrusion
        (inDocument._URL || (inDocument.impl && inDocument.impl._URL)
            || inDocument.baseURI || inDocument.URL)
                || '';
    // take only the left side if there is a #
    return url.split('#')[0];
  },
  resolveUrl: function(inBaseUrl, inUrl, inRelativeToDocument) {
    if (this.isAbsUrl(inUrl)) {
      return inUrl;
    }
    var url = this.compressUrl(this.urlToPath(inBaseUrl) + inUrl);
    if (inRelativeToDocument) {
      url = path.makeRelPath(path.getDocumentUrl(document), url);
    }
    return url;
  },
  isAbsUrl: function(inUrl) {
    return /(^data:)|(^http[s]?:)|(^\/)/.test(inUrl);
  },
  urlToPath: function(inBaseUrl) {
    var parts = inBaseUrl.split("/");
    parts.pop();
    parts.push('');
    return parts.join("/");
  },
  compressUrl: function(inUrl) {
    var parts = inUrl.split("/");
    for (var i=0, p; i<parts.length; i++) {
      p = parts[i];
      if (p === "..") {
        parts.splice(i-1, 2);
        i -= 2;
      }
    }
    return parts.join("/");
  },
  // make a relative path from source to target
  makeRelPath: function(inSource, inTarget) {
    var s, t;
    s = this.compressUrl(inSource).split("/");
    t = this.compressUrl(inTarget).split("/");
    while (s.length && s[0] === t[0]){
      s.shift();
      t.shift();
    }
    for(var i = 0, l = s.length-1; i < l; i++) {
      t.unshift("..");
    }
    var r = t.join("/");
    return r;
  },
  resolvePathsInHTML: function(root, url) {
    url = url || path.documentUrlFromNode(root)
    path.resolveAttributes(root, url);
    path.resolveStyleElts(root, url);
    // handle template.content
    var templates = root.querySelectorAll('template');
    if (templates) {
      forEach(templates, function(t) {
        if (t.content) {
          path.resolvePathsInHTML(t.content, url);
        }
      });
    }
  },
  resolvePathsInStylesheet: function(inSheet) {
    var docUrl = path.nodeUrl(inSheet);
    inSheet.__resource = path.resolveCssText(inSheet.__resource, docUrl);
  },
  resolveStyleElts: function(inRoot, inUrl) {
    var styles = inRoot.querySelectorAll('style');
    if (styles) {
      forEach(styles, function(style) {
        style.textContent = path.resolveCssText(style.textContent, inUrl);
      });
    }
  },
  resolveCssText: function(inCssText, inBaseUrl) {
    return inCssText.replace(/url\([^)]*\)/g, function(inMatch) {
      // find the url path, ignore quotes in url string
      var urlPath = inMatch.replace(/["']/g, "").slice(4, -1);
      urlPath = path.resolveUrl(inBaseUrl, urlPath, true);
      return "url(" + urlPath + ")";
    });
  },
  resolveAttributes: function(inRoot, inUrl) {
    // search for attributes that host urls
    var nodes = inRoot && inRoot.querySelectorAll(URL_ATTRS_SELECTOR);
    if (nodes) {
      forEach(nodes, function(n) {
        this.resolveNodeAttributes(n, inUrl);
      }, this);
    }
  },
  resolveNodeAttributes: function(inNode, inUrl) {
    URL_ATTRS.forEach(function(v) {
      var attr = inNode.attributes[v];
      if (attr && attr.value &&
         (attr.value.search(URL_TEMPLATE_SEARCH) < 0)) {
        var urlPath = path.resolveUrl(inUrl, attr.value, true);
        attr.value = urlPath;
      }
    });
  }
};

xhr = xhr || {
  async: true,
  ok: function(inRequest) {
    return (inRequest.status >= 200 && inRequest.status < 300)
        || (inRequest.status === 304)
        || (inRequest.status === 0);
  },
  load: function(url, next, nextContext) {
    var request = new XMLHttpRequest();
    if (scope.flags.debug || scope.flags.bust) {
      url += '?' + Math.random();
    }
    request.open('GET', url, xhr.async);
    request.addEventListener('readystatechange', function(e) {
      if (request.readyState === 4) {
        next.call(nextContext, !xhr.ok(request) && request,
          request.response, url);
      }
    });
    request.send();
  }
};

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

// exports

scope.path = path;
scope.xhr = xhr;
scope.importer = importer;
scope.getDocumentUrl = path.getDocumentUrl;
scope.IMPORT_LINK_TYPE = IMPORT_LINK_TYPE;

})(window.HTMLImports);

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function(scope) {

var IMPORT_LINK_TYPE = 'import';

// highlander object for parsing a document tree

var importParser = {
  selectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'link[rel=stylesheet]',
    'style',
    'script'
  ],
  map: {
    link: 'parseLink',
    script: 'parseScript',
    style: 'parseGeneric'
  },
  parse: function(inDocument) {
    if (!inDocument.__importParsed) {
      // only parse once
      inDocument.__importParsed = true;
      // all parsable elements in inDocument (depth-first pre-order traversal)
      var elts = inDocument.querySelectorAll(importParser.selectors);
      // for each parsable node type, call the mapped parsing method
      forEach(elts, function(e) {
        importParser[importParser.map[e.localName]](e);
      });
    }
  },
  parseLink: function(linkElt) {
    if (isDocumentLink(linkElt)) {
      if (linkElt.content) {
        importParser.parse(linkElt.content);
      }
    } else {
      this.parseGeneric(linkElt);
    }
  },
  parseGeneric: function(elt) {
    if (needsMainDocumentContext(elt)) {
      document.head.appendChild(elt);
    }
  },
  parseScript: function(scriptElt) {
    if (needsMainDocumentContext(scriptElt)) {
      // acquire code to execute
      var code = (scriptElt.__resource || scriptElt.textContent).trim();
      if (code) {
        // calculate source map hint
        var moniker = scriptElt.__nodeUrl;
        if (!moniker) {
          var moniker = scope.path.documentUrlFromNode(scriptElt);
          // there could be more than one script this url
          var tag = '[' + Math.floor((Math.random()+1)*1000) + ']';
          // TODO(sjmiles): Polymer hack, should be pluggable if we need to allow 
          // this sort of thing
          var matches = code.match(/Polymer\(['"]([^'"]*)/);
          tag = matches && matches[1] || tag;
          // tag the moniker
          moniker += '/' + tag + '.js';
        }
        // source map hint
        code += "\n//# sourceURL=" + moniker + "\n";
        // evaluate the code
        eval.call(window, code);
      }
    }
  }
};

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

function isDocumentLink(elt) {
  return elt.localName === 'link'
      && elt.getAttribute('rel') === IMPORT_LINK_TYPE;
}

function needsMainDocumentContext(node) {
  // nodes can be moved to the main document:
  // if they are in a tree but not in the main document and not children of <element>
  return node.parentNode && !inMainDocument(node) 
      && !isElementElementChild(node);
}

function inMainDocument(elt) {
  return elt.ownerDocument === document ||
    // TODO(sjmiles): ShadowDOMPolyfill intrusion
    elt.ownerDocument.impl === document;
}

function isElementElementChild(elt) {
  return elt.parentNode && elt.parentNode.localName === 'element';
}

// exports

scope.parser = importParser;

})(HTMLImports);
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap

// IE shim for CustomEvent
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

function bootstrap() {
  // preload document resource trees
  HTMLImports.importer.load(document, function() {
    HTMLImports.parser.parse(document);
    HTMLImports.readyTime = new Date().getTime();
    // send HTMLImportsLoaded when finished
    document.dispatchEvent(
      new CustomEvent('HTMLImportsLoaded', {bubbles: true})
    );
  });
};

if (document.readyState === 'complete') {
  bootstrap();
} else {
  window.addEventListener('DOMContentLoaded', bootstrap);
}

})();

/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */

(function() {

// import

var IMPORT_LINK_TYPE = window.HTMLImports ? HTMLImports.IMPORT_LINK_TYPE : 'none';

// highlander object for parsing a document tree

var parser = {
  selectors: [
    'link[rel=' + IMPORT_LINK_TYPE + ']',
    'element'
  ],
  map: {
    link: 'parseLink',
    element: 'parseElement'
  },
  parse: function(inDocument) {
    if (!inDocument.__parsed) {
      // only parse once
      inDocument.__parsed = true;
      // all parsable elements in inDocument (depth-first pre-order traversal)
      var elts = inDocument.querySelectorAll(parser.selectors);
      // for each parsable node type, call the mapped parsing method
      forEach(elts, function(e) {
        parser[parser.map[e.localName]](e);
      });
      // upgrade all upgradeable static elements, anything dynamically
      // created should be caught by observer
      CustomElements.upgradeDocument(inDocument);
      // observe document for dom changes
      CustomElements.observeDocument(inDocument);
    }
  },
  parseLink: function(linkElt) {
    // imports
    if (isDocumentLink(linkElt)) {
      this.parseImport(linkElt);
    }
  },
  parseImport: function(linkElt) {
    if (linkElt.content) {
      parser.parse(linkElt.content);
    }
  },
  parseElement: function(inElementElt) {
    new HTMLElementElement(inElementElt);
  }
};

function isDocumentLink(inElt) {
  return (inElt.localName === 'link'
      && inElt.getAttribute('rel') === IMPORT_LINK_TYPE);
}

var forEach = Array.prototype.forEach.call.bind(Array.prototype.forEach);

// exports

CustomElements.parser = parser;

})();
/*
 * Copyright 2013 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(){

// bootstrap parsing

function bootstrap() {
  // go async so call stack can unwind
  setTimeout(function() {
    // parse document
    CustomElements.parser.parse(document);
    // one more pass before register is 'live'
    CustomElements.upgradeDocument(document);  
    // set internal 'ready' flag, now document.register will trigger 
    // synchronous upgrades
    CustomElements.ready = true;
    // capture blunt profiling data
    CustomElements.readyTime = Date.now();
    if (window.HTMLImports) {
      CustomElements.elapsed = CustomElements.readyTime - HTMLImports.readyTime;
    }
    // notify the system that we are bootstrapped
    document.body.dispatchEvent(
      new CustomEvent('WebComponentsReady', {bubbles: true})
    );
  }, 0);
}

// CustomEvent shim for IE
if (typeof window.CustomEvent !== 'function') {
  window.CustomEvent = function(inType) {
     var e = document.createEvent('HTMLEvents');
     e.initEvent(inType, true, true);
     return e;
  };
}

if (document.readyState === 'complete') {
  bootstrap();
} else {
  var loadEvent = window.HTMLImports ? 'HTMLImportsLoaded' : 'DOMContentLoaded';
  window.addEventListener(loadEvent, bootstrap);
}

})();

(function () {

/*** Variables ***/

  var win = window,
    doc = document,
    noop = function(){},
    regexPseudoSplit = /([\w-]+(?:\([^\)]+\))?)/g,
    regexPseudoReplace = /(\w*)(?:\(([^\)]*)\))?/,
    regexDigits = /(\d+)/g,
    keypseudo = {
      action: function (pseudo, event) {
        return pseudo.value.match(regexDigits).indexOf(String(event.keyCode)) > -1 == (pseudo.name == 'keypass');
      }
    },
    prefix = (function () {
      var styles = win.getComputedStyle(doc.documentElement, ''),
          pre = (Array.prototype.slice
            .call(styles)
            .join('')
            .match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
          )[1];
      return {
        dom: pre == 'ms' ? pre.toUpperCase() : pre,
        lowercase: pre,
        css: '-' + pre + '-',
        js: pre == 'ms' ? pre : pre[0].toUpperCase() + pre.substr(1)
      };

    })(),
    matchSelector = Element.prototype.matchesSelector || Element.prototype[prefix.lowercase + 'MatchesSelector'],
    mutation = win.MutationObserver || win[prefix.js + 'MutationObserver'];

/*** Functions ***/

// Utilities

  var typeObj = {};
  function typeOf(obj) {
    return typeObj.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }

  function clone(item, type){
    var fn = clone[type || typeOf(item)];
    return fn ? fn(item) : item;
  }
    clone.object = function(src){
      var obj = {};
      for (var key in src) obj[key] = clone(src[key]);
      return obj;
    };
    clone.array = function(src){
      var i = src.length, array = new Array(i);
      while (i--) array[i] = clone(src[i]);
      return array;
    };

  var unsliceable = ['number', 'boolean', 'string', 'function'];
  function toArray(obj){
    return unsliceable.indexOf(typeOf(obj)) == -1 ?
    Array.prototype.slice.call(obj, 0) :
    [obj];
  }

// DOM
  var str = '';
  function query(element, selector){
    return (selector || str).length ? toArray(element.querySelectorAll(selector)) : [];
  }

  function parseMutations(element, mutations) {
    var diff = { added: [], removed: [] };
    mutations.forEach(function(record){
      record._mutation = true;
      for (var z in diff) {
        var type = element._records[(z == 'added') ? 'inserted' : 'removed'],
          nodes = record[z + 'Nodes'], length = nodes.length;
        for (var i = 0; i < length && diff[z].indexOf(nodes[i]) == -1; i++){
          diff[z].push(nodes[i]);
          type.forEach(function(fn){
            fn(nodes[i], record);
          });
        }
      }
    });
  }

// Mixins

  function mergeOne(source, key, current){
    var type = typeOf(current);
    if (type == 'object' && typeOf(source[key]) == 'object') xtag.merge(source[key], current);
    else source[key] = clone(current, type);
    return source;
  }

  function mergeMixin(type, mixin, option) {
    var original = {};
    for (var o in option) original[o.split(':')[0]] = true;
    for (var x in mixin) if (!original[x.split(':')[0]]) option[x] = mixin[x];
  }

  function applyMixins(tag) {
    tag.mixins.forEach(function (name) {
      var mixin = xtag.mixins[name];
      for (var type in mixin) {
        switch (type) {
          case 'lifecycle': case 'methods':
            mergeMixin(type, mixin[type], tag[type]);
            break;
          case 'accessors': case 'prototype':
            for (var z in mixin[type]) mergeMixin(z, mixin[type], tag.accessors);
            break;
          case 'events':
            break;
        }
      }
    });
    return tag;
  }

// Events

  function touchFilter(custom, event) {
    if (event.type.match('touch')){
      custom.listener.touched = true;
    }
    else if (custom.listener.touched && event.type.match('mouse')){
      custom.listener.touched = false;
      return false;
    }
    return true;
  }

  function createFlowEvent(type) {
    var flow = type == 'over';
    return {
      base: 'OverflowEvent' in win ? 'overflowchanged' : type + 'flow',
      condition: function (custom, event) {
        event.flow = type;
        return event.type == (type + 'flow') ||
        ((event.orient === 0 && event.horizontalOverflow == flow) ||
        (event.orient == 1 && event.verticalOverflow == flow) ||
        (event.orient == 2 && event.horizontalOverflow == flow && event.verticalOverflow == flow));
      }
    };
  }

// Accessors

  function getArgs(attr, value){
    return {
      value: attr.boolean ? '' : value,
      method: attr.boolean && !value ? 'removeAttribute' : 'setAttribute'
    };
  }

  function modAttr(element, attr, name, value){
    var args = getArgs(attr, value);
    element[args.method](name, args.value);
  }

  function syncAttr(element, attr, name, value, method){
    var nodes = attr.property ? [element.xtag[attr.property]] : attr.selector ? xtag.query(element, attr.selector) : [],
        index = nodes.length;
    while (index--) nodes[index][method](name, value);
  }

  function updateView(element, name, value){
    if (element.__view__){
      element.__view__.updateBindingValue(element, name, value);
    }
  }

  function attachProperties(tag, prop, z, accessor, attr, name){
    var key = z.split(':'), type = key[0];
    if (type == 'get') {
      key[0] = prop;
      tag.prototype[prop].get = xtag.applyPseudos(key.join(':'), accessor[z], tag.pseudos);
    }
    else if (type == 'set') {
      key[0] = prop;
      var setter = tag.prototype[prop].set = xtag.applyPseudos(key.join(':'), attr ? function(value){
        this.xtag._skipSet = true;
        if (!this.xtag._skipAttr) modAttr(this, attr, name, value);
        if (this.xtag._skipAttr && attr.skip) delete this.xtag._skipAttr;
        accessor[z].call(this, attr.boolean ? !!value : value);
        updateView(this, name, value);
        delete this.xtag._skipSet;
      } : accessor[z] ? function(value){
        accessor[z].call(this, value);
        updateView(this, name, value);
      } : null, tag.pseudos);

      if (attr) attr.setter = setter;
    }
    else tag.prototype[prop][z] = accessor[z];
  }

  function parseAccessor(tag, prop){
    tag.prototype[prop] = {};
    var accessor = tag.accessors[prop],
        attr = accessor.attribute,
        name = attr && attr.name ? attr.name.toLowerCase() : prop;

    if (attr) {
      attr.key = prop;
      tag.attributes[name] = attr;
    }
    
    for (var z in accessor) attachProperties(tag, prop, z, accessor, attr, name);

    if (attr) {
      if (!tag.prototype[prop].get) {
        var method = (attr.boolean ? 'has' : 'get') + 'Attribute';
        tag.prototype[prop].get = function(){
          return this[method](name);
        };
      }
      if (!tag.prototype[prop].set) tag.prototype[prop].set = function(value){
        modAttr(this, attr, name, value);
        updateView(this, name, value);
      };
    }
  }

/*** X-Tag Object Definition ***/

  var xtag = {
    tags: {},
    defaultOptions: {
      pseudos: [],
      mixins: [],
      events: {},
      methods: {},
      accessors: {
        template: {
          attribute: {},
          set: function(value){
            var last = this.getAttribute('template');
            this.xtag.__previousTemplate__ = last;
            xtag.fireEvent(this, 'templatechange', { template: value });
          }
        }
      },
      lifecycle: {},
      attributes: {},
      'prototype': {
        xtag: {
          get: function(){
            return this.__xtag__ ? this.__xtag__ : (this.__xtag__ = { data: {} });
          }
        }
      }
    },
    register: function (name, options) {
      var element, _name;
      if (typeof name == 'string') {
        _name = name.toLowerCase();
      } else if (name.nodeName == 'ELEMENT') {
        element = name;
        _name = element.getAttribute('name').toLowerCase();
      } else {
        return;
      }

      var tag = xtag.tags[_name] = applyMixins(xtag.merge({}, xtag.defaultOptions, options));

      for (var z in tag.events) tag.events[z] = xtag.parseEvent(z, tag.events[z]);
      for (z in tag.lifecycle) tag.lifecycle[z.split(':')[0]] = xtag.applyPseudos(z, tag.lifecycle[z], tag.pseudos);
      for (z in tag.methods) tag.prototype[z.split(':')[0]] = { value: xtag.applyPseudos(z, tag.methods[z], tag.pseudos), enumerable: true };
      for (z in tag.accessors) parseAccessor(tag, z);

      var ready = tag.lifecycle.created || tag.lifecycle.ready;
      tag.prototype.readyCallback = {
        enumerable: true,
        value: function(){
          var element = this;
          var template = element.getAttribute('template');
          if (template){
            xtag.fireEvent(this, 'templatechange', { template: template });
          }
          xtag.addEvents(this, tag.events);
          tag.mixins.forEach(function(mixin){
            if (xtag.mixins[mixin].events) xtag.addEvents(element, xtag.mixins[mixin].events);
          });
          var output = ready ? ready.apply(this, toArray(arguments)) : null;
          for (var name in tag.attributes) {
            var attr = tag.attributes[name],
                hasAttr = this.hasAttribute(name);
            if (hasAttr || attr.boolean) {
              this[attr.key] = attr.boolean ? hasAttr : this.getAttribute(name);
            }
          }
          tag.pseudos.forEach(function(obj){
            obj.onAdd.call(element, obj);
          });
          return output;
        }
      };

      if (tag.lifecycle.inserted) tag.prototype.insertedCallback = { value: tag.lifecycle.inserted, enumerable: true };
      if (tag.lifecycle.removed) tag.prototype.removedCallback = { value: tag.lifecycle.removed, enumerable: true };
      if (tag.lifecycle.attributeChanged) tag.prototype.attributeChangedCallback = { value: tag.lifecycle.attributeChanged, enumerable: true };

      var setAttribute = tag.prototype.setAttribute || HTMLElement.prototype.setAttribute;
      tag.prototype.setAttribute = {
        writable: true,
        enumberable: true,
        value: function (name, value){
          var attr = tag.attributes[name.toLowerCase()];
          if (!this.xtag._skipAttr) setAttribute.call(this, name, attr && attr.boolean ? '' : value);
          if (attr) {
            if (attr.setter && !this.xtag._skipSet) {
              this.xtag._skipAttr = true;
              attr.setter.call(this, attr.boolean ? true : value);
            }
            value = attr.skip ? attr.boolean ? this.hasAttribute(name) : this.getAttribute(name) : value;
            syncAttr(this, attr, name, attr.boolean ? '' : value, 'setAttribute');
          }
          delete this.xtag._skipAttr;
        }
      };

      var removeAttribute = tag.prototype.removeAttribute || HTMLElement.prototype.removeAttribute;
      tag.prototype.removeAttribute = {
        writable: true,
        enumberable: true,
        value: function (name){
          var attr = tag.attributes[name.toLowerCase()];
          if (!this.xtag._skipAttr) removeAttribute.call(this, name);
          if (attr) {
            if (attr.setter && !this.xtag._skipSet) {
              this.xtag._skipAttr = true;
              attr.setter.call(this, attr.boolean ? false : undefined);
            }
            syncAttr(this, attr, name, undefined, 'removeAttribute');
          }
          delete this.xtag._skipAttr;
        }
      };

      if (element){
        element.register({
          'prototype': Object.create(Object.prototype, tag.prototype)
        });
      } else {
        return doc.register(_name, {
          'extends': options['extends'],
          'prototype': Object.create(Object.create((options['extends'] ?
            document.createElement(options['extends']).constructor :
            win.HTMLElement).prototype, tag.prototype), tag.prototype)
        });
      }
    },

    /* Exposed Variables */

    mixins: {},
    prefix: prefix,
    templates: {},
    captureEvents: ['focus', 'blur', 'scroll', 'underflow', 'overflow', 'overflowchanged'],
    customEvents: {
      overflow: createFlowEvent('over'),
      underflow: createFlowEvent('under'),
      animationstart: {
        base: [
          'animationstart',
          'oAnimationStart',
          'MSAnimationStart',
          'webkitAnimationStart'
        ]
      },
      transitionend: {
        base: [
          'transitionend',
          'oTransitionEnd',
          'MSTransitionEnd',
          'webkitTransitionEnd'
        ]
      },
      tap: {
        base: ['click', 'touchend'],
        condition: touchFilter
      },
      tapstart: {
        base: ['mousedown', 'touchstart'],
        condition: touchFilter
      },
      tapend: {
        base: ['mouseup', 'touchend'],
        condition: touchFilter
      },
      tapenter: {
        base: ['mouseover', 'touchenter'],
        condition: touchFilter
      },
      tapleave: {
        base: ['mouseout', 'touchleave'],
        condition: touchFilter
      },
      tapmove: {
        base: ['mousemove', 'touchmove'],
        condition: touchFilter
      }
    },
    pseudos: {
      keypass: keypseudo,
      keyfail: keypseudo,
      delegate: {
        action: function (pseudo, event) {
          var target = query(this, pseudo.value).filter(function (node) {
            return node == event.target || node.contains ? node.contains(event.target) : false;
          })[0];
          return target ? pseudo.listener = pseudo.listener.bind(target) : false;
        }
      },
      preventable: {
        action: function (pseudo, event) {
          return !event.defaultPrevented;
        }
      }
    },

    /* UTILITIES */

    clone: clone,
    typeOf: typeOf,
    toArray: toArray,

    wrap: function (original, fn) {
      return function(){
        var args = toArray(arguments),
          returned = original.apply(this, args);
        return returned === false ? false : fn.apply(this, typeof returned != 'undefined' ? toArray(returned) : args);
      };
    },

    merge: function(source, k, v){
      if (typeOf(k) == 'string') return mergeOne(source, k, v);
      for (var i = 1, l = arguments.length; i < l; i++){
        var object = arguments[i];
        for (var key in object) mergeOne(source, key, object[key]);
      }
      return source;
    },

    uid: function(){
      return Math.random().toString(36).substr(2,10);
    },

    /* DOM */

    query: query,

    skipTransition: function(element, fn, bind){
      var prop = prefix.js + 'TransitionProperty';
      element.style[prop] = element.style.transitionProperty = 'none';
      xtag.requestFrame(function(){
        var callback;
        if (fn) callback = fn.call(bind);
        xtag.requestFrame(function(){
          element.style[prop] = element.style.transitionProperty = '';
          if (callback) xtag.requestFrame(callback);
        });
      });
    },

    requestFrame: (function(){
      var raf = win.requestAnimationFrame ||
        win[prefix.lowercase + 'RequestAnimationFrame'] ||
        function(fn){ return win.setTimeout(fn, 20); };
      return function(fn){
        return raf.call(win, fn);
      };
    })(),

    matchSelector: function (element, selector) {
      return matchSelector.call(element, selector);
    },

    set: function (element, method, value) {
      element[method] = value;
      if (window.CustomElements) CustomElements.upgradeAll(element);
    },

    innerHTML: function(el, html){
      xtag.set(el, 'innerHTML', html);
    },

    hasClass: function (element, klass) {
      return element.className.split(' ').indexOf(klass.trim())>-1;
    },

    addClass: function (element, klass) {
      var list = element.className.trim().split(' ');
      klass.trim().split(' ').forEach(function (name) {
        if (!~list.indexOf(name)) list.push(name);
      });
      element.className = list.join(' ').trim();
      return element;
    },

    removeClass: function (element, klass) {
      var classes = klass.trim().split(' ');
      element.className = element.className.trim().split(' ').filter(function (name) {
        return name && !~classes.indexOf(name);
      }).join(' ');
      return element;
    },

    toggleClass: function (element, klass) {
      return xtag[xtag.hasClass(element, klass) ? 'removeClass' : 'addClass'].call(null, element, klass);
    },

    queryChildren: function (element, selector) {
      var id = element.id,
        guid = element.id = id || 'x_' + xtag.uid(),
        attr = '#' + guid + ' > ';
      selector = attr + (selector + '').replace(',', ',' + attr, 'g');
      var result = element.parentNode.querySelectorAll(selector);
      if (!id) element.removeAttribute('id');
      return toArray(result);
    },

    createFragment: function(content) {
      var frag = doc.createDocumentFragment();
      if (content) {
        var div = frag.appendChild(doc.createElement('div')),
          nodes = toArray(content.nodeName ? arguments : !(div.innerHTML = content) || div.children),
          length = nodes.length,
          index = 0;
        while (index < length) frag.insertBefore(nodes[index++], div);
        frag.removeChild(div);
      }
      return frag;
    },

    manipulate: function(element, fn){
      var next = element.nextSibling,
        parent = element.parentNode,
        frag = doc.createDocumentFragment(),
        returned = fn.call(frag.appendChild(element), frag) || element;
      if (next) parent.insertBefore(returned, next);
      else parent.appendChild(returned);
    },

    /* PSEUDOS */

    applyPseudos: function(key, fn, element) {
      var listener = fn,
          pseudos = {};
      if (key.match(':')) {
        var split = key.match(regexPseudoSplit),
            i = split.length;
        while (--i) {
          split[i].replace(regexPseudoReplace, function (match, name, value) {
            if (!xtag.pseudos[name]) throw "pseudo not found: " + name + " " + split;
            var pseudo = pseudos[i] = Object.create(xtag.pseudos[name]);
                pseudo.key = key;
                pseudo.name = name;
                pseudo.value = value;
            var last = listener;
            listener = function(){
              var args = toArray(arguments),
                  obj = {
                    key: key,
                    name: name,
                    value: value,
                    listener: last
                  };
              if (pseudo.action && pseudo.action.apply(this, [obj].concat(args)) === false) return false;
              return obj.listener.apply(this, args);
            };
            if (element && pseudo.onAdd) {
              if (element.getAttribute) {
                pseudo.onAdd.call(element, pseudo);
              } else {
                element.push(pseudo);
              }
            }
          });
        }
      }
      for (var z in pseudos) {
        if (pseudos[z].onCompiled) listener = pseudos[z].onCompiled(listener, pseudos[z]);
      }
      return listener;
    },

    removePseudos: function(element, event){
      event._pseudos.forEach(function(obj){
        obj.onRemove.call(element, obj);
      });
    },

  /*** Events ***/

    parseEvent: function(type, fn) {
      var pseudos = type.split(':'),
        key = pseudos.shift(),
        event = xtag.merge({
          base: key,
          pseudos: '',
          _pseudos: [],
          onAdd: noop,
          onRemove: noop,
          condition: noop
        }, xtag.customEvents[key] || {});
      event.type = key + (event.pseudos.length ? ':' + event.pseudos : '') + (pseudos.length ? ':' + pseudos.join(':') : '');
      if (fn) {
        var chained = xtag.applyPseudos(event.type, fn, event._pseudos);
        event.listener = function(){
          var args = toArray(arguments);
          if (event.condition.apply(this, [event].concat(args)) === false) return false;
          return chained.apply(this, args);
        };
      }
      return event;
    },

    addEvent: function (element, type, fn) {
      var event = (typeof fn == 'function') ? xtag.parseEvent(type, fn) : fn;
      event.listener.event = event;
      event._pseudos.forEach(function(obj){
        obj.onAdd.call(element, obj);
      });
      event.onAdd.call(element, event, event.listener);
      toArray(event.base).forEach(function (name) {
        element.addEventListener(name, event.listener, xtag.captureEvents.indexOf(name) > -1);
      });
      return event.listener;
    },

    addEvents: function (element, events) {
      var listeners = {};
      for (var z in events) {
        listeners[z] = xtag.addEvent(element, z, events[z]);
      }
      return listeners;
    },

    removeEvent: function (element, type, fn) {
      var event = fn.event;
      event.onRemove.call(element, event, fn);
      xtag.removePseudos(element, event);
      toArray(event.base).forEach(function (name) {
        element.removeEventListener(name, fn);
      });
    },

    removeEvents: function(element, listeners){
      for (var z in listeners) xtag.removeEvent(element, z, listeners[z]);
    },

    fireEvent: function(element, type, options, warn){
      var options = options || {},
          event = doc.createEvent('CustomEvent');
      if (warn) console.warn('fireEvent has been modified, more info here: ');
      event.initCustomEvent(type,
        options.bubbles == false ? false : true,
        options.cancelable == false ? false : true,
        options.detail
      );
      try { element.dispatchEvent(event); }
      catch (e) {
        console.warn('This error may have been caused by a change in the fireEvent method, more info here: ', e);
      }
    },

    addObserver: function(element, type, fn){
      if (!element._records) {
        element._records = { inserted: [], removed: [] };
        if (mutation){
          element._observer = new mutation(function(mutations) {
            parseMutations(element, mutations);
          });
          element._observer.observe(element, {
            subtree: true,
            childList: true,
            attributes: !true,
            characterData: false
          });
        }
        else ['Inserted', 'Removed'].forEach(function(type){
          element.addEventListener('DOMNode' + type, function(event){
            event._mutation = true;
            element._records[type.toLowerCase()].forEach(function(fn){
              fn(event.target, event);
            });
          }, false);
        });
      }
      if (element._records[type].indexOf(fn) == -1) element._records[type].push(fn);
    },

    removeObserver: function(element, type, fn){
      var obj = element._records;
      if (obj && fn){
        obj[type].splice(obj[type].indexOf(fn), 1);
      }
      else{
        obj[type] = [];
      }
    }

  };

  if (typeof define == 'function' && define.amd) define(xtag);
  else win.xtag = xtag;

  doc.addEventListener('WebComponentsReady', function(){
    xtag.fireEvent(doc.body, 'DOMComponentsLoaded');
  });

})();

(function(){

  var hlevels = 'h1, h2, h3, h4, h5, h6',
    select = function(heading){
      xtag.query(heading.parentNode, hlevels).forEach(function(el, idx){
        if (el == heading) {
          this.selectedIndex = idx;
          heading.focus();
        }
      }, this);
    };

  xtag.register('x-accordion', {
    lifecycle:{
      created: function(){
        var idx = Number(this.getAttribute('selected-index'));
        if (idx){
          this.setSelectedIndex(idx);
        }
        else {
          var selected = xtag.queryChildren(this, '[selected]')[0];
          if (selected) select(selected);
        }
      }
    },
    events: {
      'tap:delegate(h1, h2, h3, h4, h5, h6)': function(event){
        select.call(event.target.parentNode, this);
      },
      'keydown:delegate(h1, h2, h3, h4, h5, h6)': function(event){
        switch(event.keyCode) {
          case 13: select.call(event.target.parentNode, this); break;
          case 37: event.target.parentNode.selectPrevious(); break;
          case 39: event.target.parentNode.selectNext(); break;
        }
      }
    },
    accessors:{
      'selectedIndex':{
        attribute: { name: 'selected-index' },
        set: function(value){
          xtag.query(this, hlevels).forEach(function(el, idx){
            if (value == idx) {
              el.setAttribute('selected', null);
              xtag.fireEvent(el, 'selected');
            }
            else el.removeAttribute('selected');
          }, this);
        },
        get: function(){
          return Number(this.getAttribute('selected-index')) || xtag.queryChildren(this, hlevels).indexOf(xtag.queryChildren(this, '[selected]')[0]);
        }
      }
    },
    methods: {
      getSelected: function(){
        return xtag.queryChildren(this, '[selected]')[0];
      },
      setSelected: select,
      selectNext: function(){
        var headings = xtag.query(this, hlevels);
        if (headings[0]) select.call(this, headings[this.selectedIndex + 1] || headings[0]);
      },
      selectPrevious: function(){
        var headings = xtag.query(this, hlevels);
        if (headings[0]) select.call(this, headings[this.selectedIndex - 1] || headings.pop());
      }
    }
  });

})();

(function(){

  xtag.register('x-appbar', {
    lifecycle: {
      created: function(){
        var header = xtag.queryChildren(this, 'header')[0];
        if (!header){
          header = document.createElement('header');
          this.appendChild(growbox);
        }
        this.xtag.data.header = header;
        this.subheading = this.subheading;
      }
    },
    accessors: {
      heading: {
        get: function(){
          return this.xtag.data.header.innerHTML;
        },
        set: function(value){
          this.xtag.data.header.innerHTML = value;
        }
      },
      subheading: {
        attribute: {},
        get: function(){
          return this.getAttribute('subheading') || "";
        },
        set: function(value){
          this.xtag.data.header.setAttribute('subheading', value);
        }
      }
    }
  });

})();

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */(function(){var e=/\blang(?:uage)?-(?!\*)(\w+)\b/i,t=self.Prism={util:{type:function(e){return Object.prototype.toString.call(e).match(/\[object (\w+)\]/)[1]},clone:function(e){var n=t.util.type(e);switch(n){case"Object":var r={};for(var i in e)e.hasOwnProperty(i)&&(r[i]=t.util.clone(e[i]));return r;case"Array":return e.slice()}return e}},languages:{extend:function(e,n){var r=t.util.clone(t.languages[e]);for(var i in n)r[i]=n[i];return r},insertBefore:function(e,n,r,i){i=i||t.languages;var s=i[e],o={};for(var u in s)if(s.hasOwnProperty(u)){if(u==n)for(var a in r)r.hasOwnProperty(a)&&(o[a]=r[a]);o[u]=s[u]}return i[e]=o},DFS:function(e,n){for(var r in e){n.call(e,r,e[r]);t.util.type(e)==="Object"&&t.languages.DFS(e[r],n)}}},highlightAll:function(e,n){var r=document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');for(var i=0,s;s=r[i++];)t.highlightElement(s,e===!0,n)},highlightElement:function(r,i,s){var o,u,a=r;while(a&&!e.test(a.className))a=a.parentNode;if(a){o=(a.className.match(e)||[,""])[1];u=t.languages[o]}if(!u)return;r.className=r.className.replace(e,"").replace(/\s+/g," ")+" language-"+o;a=r.parentNode;/pre/i.test(a.nodeName)&&(a.className=a.className.replace(e,"").replace(/\s+/g," ")+" language-"+o);var f=r.textContent;if(!f)return;f=f.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\u00a0/g," ");var l={element:r,language:o,grammar:u,code:f};t.hooks.run("before-highlight",l);if(i&&self.Worker){var c=new Worker(t.filename);c.onmessage=function(e){l.highlightedCode=n.stringify(JSON.parse(e.data));l.element.innerHTML=l.highlightedCode;s&&s.call(l.element);t.hooks.run("after-highlight",l)};c.postMessage(JSON.stringify({language:l.language,code:l.code}))}else{l.highlightedCode=t.highlight(l.code,l.grammar);l.element.innerHTML=l.highlightedCode;s&&s.call(r);t.hooks.run("after-highlight",l)}},highlight:function(e,r){return n.stringify(t.tokenize(e,r))},tokenize:function(e,n){var r=t.Token,i=[e],s=n.rest;if(s){for(var o in s)n[o]=s[o];delete n.rest}e:for(var o in n){if(!n.hasOwnProperty(o)||!n[o])continue;var u=n[o],a=u.inside,f=!!u.lookbehind||0;u=u.pattern||u;for(var l=0;l<i.length;l++){var c=i[l];if(i.length>e.length)break e;if(c instanceof r)continue;u.lastIndex=0;var h=u.exec(c);if(h){f&&(f=h[1].length);var p=h.index-1+f,h=h[0].slice(f),d=h.length,v=p+d,m=c.slice(0,p+1),g=c.slice(v+1),y=[l,1];m&&y.push(m);var b=new r(o,a?t.tokenize(h,a):h);y.push(b);g&&y.push(g);Array.prototype.splice.apply(i,y)}}}return i},hooks:{all:{},add:function(e,n){var r=t.hooks.all;r[e]=r[e]||[];r[e].push(n)},run:function(e,n){var r=t.hooks.all[e];if(!r||!r.length)return;for(var i=0,s;s=r[i++];)s(n)}}},n=t.Token=function(e,t){this.type=e;this.content=t};n.stringify=function(e){if(typeof e=="string")return e;if(Object.prototype.toString.call(e)=="[object Array]"){for(var r=0;r<e.length;r++)e[r]=n.stringify(e[r]);return e.join("")}var i={type:e.type,content:n.stringify(e.content),tag:"span",classes:["token",e.type],attributes:{}};i.type=="comment"&&(i.attributes.spellcheck="true");t.hooks.run("wrap",i);var s="";for(var o in i.attributes)s+=o+'="'+(i.attributes[o]||"")+'"';return"<"+i.tag+' class="'+i.classes.join(" ")+'" '+s+">"+i.content+"</"+i.tag+">"};if(!self.document){self.addEventListener("message",function(e){var n=JSON.parse(e.data),r=n.language,i=n.code;self.postMessage(JSON.stringify(t.tokenize(i,t.languages[r])));self.close()},!1);return}var r=document.getElementsByTagName("script");r=r[r.length-1];if(r){t.filename=r.src;document.addEventListener&&!r.hasAttribute("data-manual")&&document.addEventListener("DOMContentLoaded",t.highlightAll)}})();;
Prism.languages.markup={comment:/&lt;!--[\w\W]*?--(&gt;|&gt;)/g,prolog:/&lt;\?.+?\?&gt;/,doctype:/&lt;!DOCTYPE.+?&gt;/,cdata:/&lt;!\[CDATA\[[\w\W]+?]]&gt;/i,tag:{pattern:/&lt;\/?[\w:-]+\s*(?:\s+[\w:-]+(?:=(?:("|')(\\?[\w\W])*?\1|\w+))?\s*)*\/?&gt;/gi,inside:{tag:{pattern:/^&lt;\/?[\w:-]+/i,inside:{punctuation:/^&lt;\/?/,namespace:/^[\w-]+?:/}},"attr-value":{pattern:/=(?:('|")[\w\W]*?(\1)|[^\s>]+)/gi,inside:{punctuation:/=|&gt;|"/g}},punctuation:/\/?&gt;/g,"attr-name":{pattern:/[\w:-]+/g,inside:{namespace:/^[\w-]+?:/}}}},entity:/&amp;#?[\da-z]{1,8};/gi};Prism.hooks.add("wrap",function(e){e.type==="entity"&&(e.attributes.title=e.content.replace(/&amp;/,"&"))});;
Prism.languages.css={comment:/\/\*[\w\W]*?\*\//g,atrule:/@[\w-]+?(\s+[^;{]+)?(?=\s*{|\s*;)/gi,url:/url\((["']?).*?\1\)/gi,selector:/[^\{\}\s][^\{\}]*(?=\s*\{)/g,property:/(\b|\B)[a-z-]+(?=\s*:)/ig,string:/("|')(\\?.)*?\1/g,important:/\B!important\b/gi,ignore:/&(lt|gt|amp);/gi,punctuation:/[\{\};:]/g};Prism.languages.markup&&Prism.languages.insertBefore("markup","tag",{style:{pattern:/(&lt;|<)style[\w\W]*?(>|&gt;)[\w\W]*?(&lt;|<)\/style(>|&gt;)/ig,inside:{tag:{pattern:/(&lt;|<)style[\w\W]*?(>|&gt;)|(&lt;|<)\/style(>|&gt;)/ig,inside:Prism.languages.markup.tag.inside},rest:Prism.languages.css}}});;
Prism.languages.clike={comment:{pattern:/(^|[^\\])(\/\*[\w\W]*?\*\/|\/\/.*?(\r?\n|$))/g,lookbehind:!0},string:/("|')(\\?.)*?\1/g,keyword:/\b(if|else|while|do|for|return|in|instanceof|function|new|try|catch|finally|null|break|continue)\b/g,"boolean":/\b(true|false)\b/g,number:/\b-?(0x)?\d*\.?[\da-f]+\b/g,operator:/[-+]{1,2}|!|=?&lt;|=?&gt;|={1,2}|(&amp;){1,2}|\|?\||\?|\*|\//g,ignore:/&(lt|gt|amp);/gi,punctuation:/[{}[\];(),.:]/g};;
Prism.languages.javascript=Prism.languages.extend("clike",{keyword:/\b(var|let|if|else|while|do|for|return|in|instanceof|function|new|with|typeof|try|catch|finally|null|break|continue)\b/g,number:/\b(-?(0x)?\d*\.?[\da-f]+|NaN|-?Infinity)\b/g});Prism.languages.insertBefore("javascript","keyword",{regex:{pattern:/(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/g,lookbehind:!0}});Prism.languages.markup&&Prism.languages.insertBefore("markup","tag",{script:{pattern:/(&lt;|<)script[\w\W]*?(>|&gt;)[\w\W]*?(&lt;|<)\/script(>|&gt;)/ig,inside:{tag:{pattern:/(&lt;|<)script[\w\W]*?(>|&gt;)|(&lt;|<)\/script(>|&gt;)/ig,inside:Prism.languages.markup.tag.inside},rest:Prism.languages.javascript}}});;

xtag.register('x-code-prism', {
  lifecycle:{
    created: function(){
      if (this.innerHTML.match(/&lt;/)){
        this.codeContent = this.innerHTML;
      } else {
        this.codeContent = this.textContent;
      }
    }
  },
  accessors:{
    'codeContent': {
      set: function(code){

        this.innerHTML = '<pre><code class="language-'+ 
          (this.getAttribute('language') || 'javascript') +'">' + 
            code + '</code></pre>';
        
        Prism.highlightElement(this.firstChild.firstChild, false);
      }
    }
  }
});
(function() {

  xtag.register('x-flipbox', {
    lifecycle: {
      created: function() {
        if (this.flipped){
          xtag.skipTransition(this.firstElementChild,function(){});
        } else {
          xtag.skipTransition(this.lastElementChild,function(){});
        }
      }
    },
    events:{
      'transitionend': function(e) {
        if (e.target == this) xtag.fireEvent(this, 'flipend');
      }
    },
    accessors: {
      direction: {
        get: function(){
          return this.getAttribute('direction');
        },
        set: function(value) {
          xtag.skipTransition(this.firstElementChild, function() {
            this.setAttribute('direction', value);
          }, this);
          xtag.skipTransition(this.lastElementChild, function() {
            this.setAttribute('direction', value);
          }, this);
        }
      },
      flipped: {
        attribute: { boolean: true }
      }
    },
    methods: {
      toggle: function() {
        this.flipped = !this.flipped;
      }
    }
  });

})();


(function(){

  xtag.register('x-growbox', {
    lifecycle: {
      created: function(){
        var children = xtag.toArray(this.children);
        this.innerHTML = this.templateHTML;
        xtag.addEvent(this.firstElementChild.firstElementChild.nextElementSibling, 'overflow', this.matchDimensions.bind(this));
        xtag.addEvent(this.firstElementChild.lastElementChild, 'underflow', this.matchDimensions.bind(this));
        children.forEach(function(el){
          this.appendChild(el);
        }, this.firstElementChild.firstElementChild);
        this.matchDimensions();
      }
    },
    prototype: {
      templateHTML: {
      value: '<div class="x-grow-wrap" onresize="(this.parentNode.matchDimensions || function(){})(true)">' +
        '<div class="x-grow-content"></div>' +
        '<div class="x-grow-overflow"><div></div></div>' +
        '<div class="x-grow-underflow"><div></div></div>' +
      '</div>'
      }
    },
    methods: {
      matchDimensions: function(resize){
        var wrap = this.firstElementChild;
        if (!wrap || wrap.className != 'x-grow-wrap') return false;
        this.style.height = (resize === true) ? window.getComputedStyle(wrap).height : wrap.scrollHeight + 'px';
        wrap.firstElementChild.nextElementSibling.firstChild.style.height = wrap.scrollHeight - 1 + 'px';
        wrap.lastElementChild.firstChild.style.height = wrap.scrollHeight + 1 + 'px';
      }
    },
    events:{
      'overflow': function(){
        this.matchDimensions();
      },
      'underflow': function(){
        this.matchDimensions();
      }
    }
  });

})();

(function() {

  /*
    ***This is the copyright block for the inclusion of the CloudMade/Leaflet JS mapping library***

    Copyright (c) 2010-2012, CloudMade, Vladimir Agafonkin
    Leaflet is a modern open-source JavaScript library for interactive maps.
    http://leaflet.cloudmade.com
  */

  (function(){var e,t;typeof exports!="undefined"?e=exports:(e={},t=window.L,e.noConflict=function(){return window.L=t,e},window.L=e),e.version="0.4",e.Util={extend:function(e){var t=Array.prototype.slice.call(arguments,1);for(var n=0,r=t.length,i;n<r;n++){i=t[n]||{};for(var s in i)i.hasOwnProperty(s)&&(e[s]=i[s])}return e},bind:function(e,t){var n=arguments.length>2?Array.prototype.slice.call(arguments,2):null;return function(){return e.apply(t,n||arguments)}},stamp:function(){var e=0,t="_leaflet_id";return function(n){return n[t]=n[t]||++e,n[t]}}(),requestAnimFrame:function(){function t(e){window.setTimeout(e,1e3/60)}var n=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||t;return function(r,i,s,o){r=i?e.Util.bind(r,i):r;if(!s||n!==t)return n.call(window,r,o);r()}}(),cancelAnimFrame:function(){var e=window.cancelAnimationFrame||window.webkitCancelRequestAnimationFrame||window.mozCancelRequestAnimationFrame||window.oCancelRequestAnimationFrame||window.msCancelRequestAnimationFrame||clearTimeout;return function(t){if(!t)return;return e.call(window,t)}}(),limitExecByInterval:function(e,t,n){var r,i;return function s(){var o=arguments;if(r){i=!0;return}r=!0,setTimeout(function(){r=!1,i&&(s.apply(n,o),i=!1)},t),e.apply(n,o)}},falseFn:function(){return!1},formatNum:function(e,t){var n=Math.pow(10,t||5);return Math.round(e*n)/n},setOptions:function(t,n){return t.options=e.Util.extend({},t.options,n),t.options},getParamString:function(e){var t=[];for(var n in e)e.hasOwnProperty(n)&&t.push(n+"="+e[n]);return"?"+t.join("&")},template:function(e,t){return e.replace(/\{ *([\w_]+) *\}/g,function(e,n){var r=t[n];if(!t.hasOwnProperty(n))throw Error("No value provided for variable "+e);return r})},emptyImageUrl:"data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="},e.Class=function(){},e.Class.extend=function(t){var n=function(){this.initialize&&this.initialize.apply(this,arguments)},r=function(){};r.prototype=this.prototype;var i=new r;i.constructor=n,n.prototype=i;for(var s in this)this.hasOwnProperty(s)&&s!=="prototype"&&(n[s]=this[s]);return t.statics&&(e.Util.extend(n,t.statics),delete t.statics),t.includes&&(e.Util.extend.apply(null,[i].concat(t.includes)),delete t.includes),t.options&&i.options&&(t.options=e.Util.extend({},i.options,t.options)),e.Util.extend(i,t),n},e.Class.include=function(t){e.Util.extend(this.prototype,t)},e.Class.mergeOptions=function(t){e.Util.extend(this.prototype.options,t)},e.Mixin={},e.Mixin.Events={addEventListener:function(e,t,n){var r=this._leaflet_events=this._leaflet_events||{};return r[e]=r[e]||[],r[e].push({action:t,context:n||this}),this},hasEventListeners:function(e){var t="_leaflet_events";return t in this&&e in this[t]&&this[t][e].length>0},removeEventListener:function(e,t,n){if(!this.hasEventListeners(e))return this;for(var r=0,i=this._leaflet_events,s=i[e].length;r<s;r++)if(i[e][r].action===t&&(!n||i[e][r].context===n))return i[e].splice(r,1),this;return this},fireEvent:function(t,n){if(!this.hasEventListeners(t))return this;var r=e.Util.extend({type:t,target:this},n),i=this._leaflet_events[t].slice();for(var s=0,o=i.length;s<o;s++)i[s].action.call(i[s].context||this,r);return this}},e.Mixin.Events.on=e.Mixin.Events.addEventListener,e.Mixin.Events.off=e.Mixin.Events.removeEventListener,e.Mixin.Events.fire=e.Mixin.Events.fireEvent,function(){var t=navigator.userAgent.toLowerCase(),n=!!window.ActiveXObject,r=t.indexOf("webkit")!==-1,i=typeof orientation!="undefined"?!0:!1,s=t.indexOf("android")!==-1,o=window.opera;e.Browser={ie:n,ie6:n&&!window.XMLHttpRequest,webkit:r,webkit3d:r&&"WebKitCSSMatrix"in window&&"m11"in new window.WebKitCSSMatrix,gecko:t.indexOf("gecko")!==-1,opera:o,android:s,mobileWebkit:i&&r,mobileOpera:i&&o,mobile:i,touch:function(){var e=!1,t="ontouchstart";if(t in document.documentElement)return!0;var n=document.createElement("div");return!n.setAttribute||!n.removeAttribute?!1:(n.setAttribute(t,"return;"),typeof n[t]=="function"&&(e=!0),n.removeAttribute(t),n=null,e)}()}}(),e.Point=function(e,t,n){this.x=n?Math.round(e):e,this.y=n?Math.round(t):t},e.Point.prototype={add:function(e){return this.clone()._add(e)},_add:function(e){return this.x+=e.x,this.y+=e.y,this},subtract:function(e){return this.clone()._subtract(e)},_subtract:function(e){return this.x-=e.x,this.y-=e.y,this},divideBy:function(t,n){return new e.Point(this.x/t,this.y/t,n)},multiplyBy:function(t){return new e.Point(this.x*t,this.y*t)},distanceTo:function(e){var t=e.x-this.x,n=e.y-this.y;return Math.sqrt(t*t+n*n)},round:function(){return this.clone()._round()},_round:function(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this},clone:function(){return new e.Point(this.x,this.y)},toString:function(){return"Point("+e.Util.formatNum(this.x)+", "+e.Util.formatNum(this.y)+")"}},e.Bounds=e.Class.extend({initialize:function(e,t){if(!e)return;var n=e instanceof Array?e:[e,t];for(var r=0,i=n.length;r<i;r++)this.extend(n[r])},extend:function(t){!this.min&&!this.max?(this.min=new e.Point(t.x,t.y),this.max=new e.Point(t.x,t.y)):(this.min.x=Math.min(t.x,this.min.x),this.max.x=Math.max(t.x,this.max.x),this.min.y=Math.min(t.y,this.min.y),this.max.y=Math.max(t.y,this.max.y))},getCenter:function(t){return new e.Point((this.min.x+this.max.x)/2,(this.min.y+this.max.y)/2,t)},contains:function(t){var n,r;return t instanceof e.Bounds?(n=t.min,r=t.max):n=r=t,n.x>=this.min.x&&r.x<=this.max.x&&n.y>=this.min.y&&r.y<=this.max.y},intersects:function(e){var t=this.min,n=this.max,r=e.min,i=e.max,s=i.x>=t.x&&r.x<=n.x,o=i.y>=t.y&&r.y<=n.y;return s&&o}}),e.Transformation=e.Class.extend({initialize:function(e,t,n,r){this._a=e,this._b=t,this._c=n,this._d=r},transform:function(e,t){return this._transform(e.clone(),t)},_transform:function(e,t){return t=t||1,e.x=t*(this._a*e.x+this._b),e.y=t*(this._c*e.y+this._d),e},untransform:function(t,n){return n=n||1,new e.Point((t.x/n-this._b)/this._a,(t.y/n-this._d)/this._c)}}),e.DomUtil={get:function(e){return typeof e=="string"?document.getElementById(e):e},getStyle:function(e,t){var n=e.style[t];!n&&e.currentStyle&&(n=e.currentStyle[t]);if(!n||n==="auto"){var r=document.defaultView.getComputedStyle(e,null);n=r?r[t]:null}return n==="auto"?null:n},getViewportOffset:function(t){var n=0,r=0,i=t,s=document.body;do{n+=i.offsetTop||0,r+=i.offsetLeft||0;if(i.offsetParent===s&&e.DomUtil.getStyle(i,"position")==="absolute")break;if(e.DomUtil.getStyle(i,"position")==="fixed"){n+=s.scrollTop||0,r+=s.scrollLeft||0;break}i=i.offsetParent}while(i);i=t;do{if(i===s)break;n-=i.scrollTop||0,r-=i.scrollLeft||0,i=i.parentNode}while(i);return new e.Point(r,n)},create:function(e,t,n){var r=document.createElement(e);return r.className=t,n&&n.appendChild(r),r},disableTextSelection:function(){document.selection&&document.selection.empty&&document.selection.empty(),this._onselectstart||(this._onselectstart=document.onselectstart,document.onselectstart=e.Util.falseFn)},enableTextSelection:function(){document.onselectstart=this._onselectstart,this._onselectstart=null},hasClass:function(e,t){return e.className.length>0&&RegExp("(^|\\s)"+t+"(\\s|$)").test(e.className)},addClass:function(t,n){e.DomUtil.hasClass(t,n)||(t.className+=(t.className?" ":"")+n)},removeClass:function(e,t){e.className=e.className.replace(/(\S+)\s*/g,function(e,n){return n===t?"":e}).replace(/^\s+/,"")},setOpacity:function(t,n){e.Browser.ie?t.style.filter+=n!==1?"alpha(opacity="+Math.round(n*100)+")":"":t.style.opacity=n},testProp:function(e){var t=document.documentElement.style;for(var n=0;n<e.length;n++)if(e[n]in t)return e[n];return!1},getTranslateString:function(t){return e.DomUtil.TRANSLATE_OPEN+t.x+"px,"+t.y+"px"+e.DomUtil.TRANSLATE_CLOSE},getScaleString:function(t,n){var r=e.DomUtil.getTranslateString(n),i=" scale("+t+") ",s=e.DomUtil.getTranslateString(n.multiplyBy(-1));return r+i+s},setPosition:function(t,n){t._leaflet_pos=n,e.Browser.webkit3d?(t.style[e.DomUtil.TRANSFORM]=e.DomUtil.getTranslateString(n),t.style["-webkit-backface-visibility"]="hidden"):(t.style.left=n.x+"px",t.style.top=n.y+"px")},getPosition:function(e){return e._leaflet_pos}},e.Util.extend(e.DomUtil,{TRANSITION:e.DomUtil.testProp(["transition","webkitTransition","OTransition","MozTransition","msTransition"]),TRANSFORM:e.DomUtil.testProp(["transformProperty","WebkitTransform","OTransform","MozTransform","msTransform"]),TRANSLATE_OPEN:"translate"+(e.Browser.webkit3d?"3d(":"("),TRANSLATE_CLOSE:e.Browser.webkit3d?",0)":")"}),e.LatLng=function(e,t,n){var r=parseFloat(e),i=parseFloat(t);if(isNaN(r)||isNaN(i))throw Error("Invalid LatLng object: ("+e+", "+t+")");n!==!0&&(r=Math.max(Math.min(r,90),-90),i=(i+180)%360+(i<-180||i===180?180:-180)),this.lat=r,this.lng=i},e.Util.extend(e.LatLng,{DEG_TO_RAD:Math.PI/180,RAD_TO_DEG:180/Math.PI,MAX_MARGIN:1e-9}),e.LatLng.prototype={equals:function(t){if(t instanceof e.LatLng){var n=Math.max(Math.abs(this.lat-t.lat),Math.abs(this.lng-t.lng));return n<=e.LatLng.MAX_MARGIN}return!1},toString:function(){return"LatLng("+e.Util.formatNum(this.lat)+", "+e.Util.formatNum(this.lng)+")"},distanceTo:function(t){var n=6378137,r=e.LatLng.DEG_TO_RAD,i=(t.lat-this.lat)*r,s=(t.lng-this.lng)*r,o=this.lat*r,u=t.lat*r,a=Math.sin(i/2),f=Math.sin(s/2),l=a*a+f*f*Math.cos(o)*Math.cos(u);return n*2*Math.atan2(Math.sqrt(l),Math.sqrt(1-l))}},e.LatLngBounds=e.Class.extend({initialize:function(e,t){if(!e)return;var n=e instanceof Array?e:[e,t];for(var r=0,i=n.length;r<i;r++)this.extend(n[r])},extend:function(t){return t instanceof e.LatLng?!this._southWest&&!this._northEast?(this._southWest=new e.LatLng(t.lat,t.lng,!0),this._northEast=new e.LatLng(t.lat,t.lng,!0)):(this._southWest.lat=Math.min(t.lat,this._southWest.lat),this._southWest.lng=Math.min(t.lng,this._southWest.lng),this._northEast.lat=Math.max(t.lat,this._northEast.lat),this._northEast.lng=Math.max(t.lng,this._northEast.lng)):t instanceof e.LatLngBounds&&(this.extend(t._southWest),this.extend(t._northEast)),this},pad:function(t){var n=this._southWest,r=this._northEast,i=Math.abs(n.lat-r.lat)*t,s=Math.abs(n.lng-r.lng)*t;return new e.LatLngBounds(new e.LatLng(n.lat-i,n.lng-s),new e.LatLng(r.lat+i,r.lng+s))},getCenter:function(){return new e.LatLng((this._southWest.lat+this._northEast.lat)/2,(this._southWest.lng+this._northEast.lng)/2)},getSouthWest:function(){return this._southWest},getNorthEast:function(){return this._northEast},getNorthWest:function(){return new e.LatLng(this._northEast.lat,this._southWest.lng,!0)},getSouthEast:function(){return new e.LatLng(this._southWest.lat,this._northEast.lng,!0)},contains:function(t){var n=this._southWest,r=this._northEast,i,s;return t instanceof e.LatLngBounds?(i=t.getSouthWest(),s=t.getNorthEast()):i=s=t,i.lat>=n.lat&&s.lat<=r.lat&&i.lng>=n.lng&&s.lng<=r.lng},intersects:function(e){var t=this._southWest,n=this._northEast,r=e.getSouthWest(),i=e.getNorthEast(),s=i.lat>=t.lat&&r.lat<=n.lat,o=i.lng>=t.lng&&r.lng<=n.lng;return s&&o},toBBoxString:function(){var e=this._southWest,t=this._northEast;return[e.lng,e.lat,t.lng,t.lat].join(",")},equals:function(e){return e?this._southWest.equals(e.getSouthWest())&&this._northEast.equals(e.getNorthEast()):!1}}),e.Projection={},e.Projection.SphericalMercator={MAX_LATITUDE:85.0511287798,project:function(t){var n=e.LatLng.DEG_TO_RAD,r=this.MAX_LATITUDE,i=Math.max(Math.min(r,t.lat),-r),s=t.lng*n,o=i*n;return o=Math.log(Math.tan(Math.PI/4+o/2)),new e.Point(s,o)},unproject:function(t,n){var r=e.LatLng.RAD_TO_DEG,i=t.x*r,s=(2*Math.atan(Math.exp(t.y))-Math.PI/2)*r;return new e.LatLng(s,i,n)}},e.Projection.LonLat={project:function(t){return new e.Point(t.lng,t.lat)},unproject:function(t,n){return new e.LatLng(t.y,t.x,n)}},e.CRS={latLngToPoint:function(e,t){var n=this.projection.project(e),r=this.scale(t);return this.transformation._transform(n,r)},pointToLatLng:function(e,t,n){var r=this.scale(t),i=this.transformation.untransform(e,r);return this.projection.unproject(i,n)},project:function(e){return this.projection.project(e)},scale:function(e){return 256*Math.pow(2,e)}},e.CRS.EPSG3857=e.Util.extend({},e.CRS,{code:"EPSG:3857",projection:e.Projection.SphericalMercator,transformation:new e.Transformation(.5/Math.PI,.5,-0.5/Math.PI,.5),project:function(e){var t=this.projection.project(e),n=6378137;return t.multiplyBy(n)}}),e.CRS.EPSG900913=e.Util.extend({},e.CRS.EPSG3857,{code:"EPSG:900913"}),e.CRS.EPSG4326=e.Util.extend({},e.CRS,{code:"EPSG:4326",projection:e.Projection.LonLat,transformation:new e.Transformation(1/360,.5,-1/360,.5)}),e.Map=e.Class.extend({includes:e.Mixin.Events,options:{crs:e.CRS.EPSG3857,fadeAnimation:e.DomUtil.TRANSITION&&!e.Browser.android,trackResize:!0},initialize:function(t,n){n=e.Util.setOptions(this,n),this._initContainer(t),this._initLayout(),this._initHooks(),this._initEvents(),n.maxBounds&&this.setMaxBounds(n.maxBounds),n.center&&typeof n.zoom!="undefined"&&this.setView(n.center,n.zoom,!0),this._initLayers(n.layers)},setView:function(e,t){return this._resetView(e,this._limitZoom(t)),this},setZoom:function(e){return this.setView(this.getCenter(),e)},zoomIn:function(){return this.setZoom(this._zoom+1)},zoomOut:function(){return this.setZoom(this._zoom-1)},fitBounds:function(e){var t=this.getBoundsZoom(e);return this.setView(e.getCenter(),t)},fitWorld:function(){var t=new e.LatLng(-60,-170),n=new e.LatLng(85,179);return this.fitBounds(new e.LatLngBounds(t,n))},panTo:function(e){return this.setView(e,this._zoom)},panBy:function(e){return this.fire("movestart"),this._rawPanBy(e),this.fire("move"),this.fire("moveend")},setMaxBounds:function(e){this.options.maxBounds=e;if(!e)return this._boundsMinZoom=null,this;var t=this.getBoundsZoom(e,!0);return this._boundsMinZoom=t,this._loaded&&(this._zoom<t?this.setView(e.getCenter(),t):this.panInsideBounds(e)),this},panInsideBounds:function(t){var n=this.getBounds(),r=this.project(n.getSouthWest()),i=this.project(n.getNorthEast()),s=this.project(t.getSouthWest()),o=this.project(t.getNorthEast()),u=0,a=0;return i.y<o.y&&(a=o.y-i.y),i.x>o.x&&(u=o.x-i.x),r.y>s.y&&(a=s.y-r.y),r.x<s.x&&(u=s.x-r.x),this.panBy(new e.Point(u,a,!0))},addLayer:function(t,n){var r=e.Util.stamp(t);if(this._layers[r])return this;this._layers[r]=t,t.options&&!isNaN(t.options.maxZoom)&&(this._layersMaxZoom=Math.max(this._layersMaxZoom||0,t.options.maxZoom)),t.options&&!isNaN(t.options.minZoom)&&(this._layersMinZoom=Math.min(this._layersMinZoom||Infinity,t.options.minZoom)),this.options.zoomAnimation&&e.TileLayer&&t instanceof e.TileLayer&&(this._tileLayersNum++,this._tileLayersToLoad++,t.on("load",this._onTileLayerLoad,this));var i=function(){t.onAdd(this,n),this.fire("layeradd",{layer:t})};return this._loaded?i.call(this):this.on("load",i,this),this},removeLayer:function(t){var n=e.Util.stamp(t);if(!this._layers[n])return;return t.onRemove(this),delete this._layers[n],this.options.zoomAnimation&&e.TileLayer&&t instanceof e.TileLayer&&(this._tileLayersNum--,this._tileLayersToLoad--,t.off("load",this._onTileLayerLoad,this)),this.fire("layerremove",{layer:t})},hasLayer:function(t){var n=e.Util.stamp(t);return this._layers.hasOwnProperty(n)},invalidateSize:function(){var t=this.getSize();this._sizeChanged=!0,this.options.maxBounds&&this.setMaxBounds(this.options.maxBounds);if(!this._loaded)return this;var n=t.subtract(this.getSize()).divideBy(2,!0);return this._rawPanBy(n),this.fire("move"),clearTimeout(this._sizeTimer),this._sizeTimer=setTimeout(e.Util.bind(this.fire,this,"moveend"),200),this},addHandler:function(e,t){if(!t)return;return this[e]=new t(this),this.options[e]&&this[e].enable(),this},getCenter:function(e){var t=this.getSize().divideBy(2),n=this._getTopLeftPoint().add(t);return this.unproject(n,this._zoom,e)},getZoom:function(){return this._zoom},getBounds:function(){var t=this.getPixelBounds(),n=this.unproject(new e.Point(t.min.x,t.max.y),this._zoom,!0),r=this.unproject(new e.Point(t.max.x,t.min.y),this._zoom,!0);return new e.LatLngBounds(n,r)},getMinZoom:function(){var e=this.options.minZoom||0,t=this._layersMinZoom||0,n=this._boundsMinZoom||0;return Math.max(e,t,n)},getMaxZoom:function(){var e=typeof this.options.maxZoom=="undefined"?Infinity:this.options.maxZoom,t=typeof this._layersMaxZoom=="undefined"?Infinity:this._layersMaxZoom;return Math.min(e,t)},getBoundsZoom:function(t,n){var r=this.getSize(),i=this.options.minZoom||0,s=this.getMaxZoom(),o=t.getNorthEast(),u=t.getSouthWest(),a,f,l,c=!0;n&&i--;do i++,f=this.project(o,i),l=this.project(u,i),a=new e.Point(f.x-l.x,l.y-f.y),n?c=a.x<r.x||a.y<r.y:c=a.x<=r.x&&a.y<=r.y;while(c&&i<=s);return c&&n?null:n?i:i-1},getSize:function(){if(!this._size||this._sizeChanged)this._size=new e.Point(this._container.clientWidth,this._container.clientHeight),this._sizeChanged=!1;return this._size},getPixelBounds:function(){var t=this._getTopLeftPoint();return new e.Bounds(t,t.add(this.getSize()))},getPixelOrigin:function(){return this._initialTopLeftPoint},getPanes:function(){return this._panes},getContainer:function(){return this._container},mouseEventToContainerPoint:function(t){return e.DomEvent.getMousePosition(t,this._container)},mouseEventToLayerPoint:function(e){return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e))},mouseEventToLatLng:function(e){return this.layerPointToLatLng(this.mouseEventToLayerPoint(e))},containerPointToLayerPoint:function(t){return t.subtract(e.DomUtil.getPosition(this._mapPane))},layerPointToContainerPoint:function(t){return t.add(e.DomUtil.getPosition(this._mapPane))},layerPointToLatLng:function(e){return this.unproject(e.add(this._initialTopLeftPoint))},latLngToLayerPoint:function(e){return this.project(e)._round()._subtract(this._initialTopLeftPoint)},containerPointToLatLng:function(e){return this.layerPointToLatLng(this.containerPointToLayerPoint(e))},latLngToContainerPoint:function(e){return this.layerPointToContainerPoint(this.latLngToLayerPoint(e))},project:function(e,t){return t=typeof t=="undefined"?this._zoom:t,this.options.crs.latLngToPoint(e,t)},unproject:function(e,t,n){return t=typeof t=="undefined"?this._zoom:t,this.options.crs.pointToLatLng(e,t,n)},_initContainer:function(t){var n=this._container=e.DomUtil.get(t);if(n._leaflet)throw Error("Map container is already initialized.");n._leaflet=!0},_initLayout:function(){var t=this._container;t.innerHTML="",t.className+=" leaflet-container",e.Browser.touch&&(t.className+=" leaflet-touch"),this.options.fadeAnimation&&(t.className+=" leaflet-fade-anim");var n=e.DomUtil.getStyle(t,"position");n!=="absolute"&&n!=="relative"&&(t.style.position="relative"),this._initPanes(),this._initControlPos&&this._initControlPos()},_initPanes:function(){var e=this._panes={};this._mapPane=e.mapPane=this._createPane("leaflet-map-pane",this._container),this._tilePane=e.tilePane=this._createPane("leaflet-tile-pane",this._mapPane),this._objectsPane=e.objectsPane=this._createPane("leaflet-objects-pane",this._mapPane),e.shadowPane=this._createPane("leaflet-shadow-pane"),e.overlayPane=this._createPane("leaflet-overlay-pane"),e.markerPane=this._createPane("leaflet-marker-pane"),e.popupPane=this._createPane("leaflet-popup-pane")},_createPane:function(t,n){return e.DomUtil.create("div",t,n||this._objectsPane)},_initializers:[],_initHooks:function(){var e,t;for(e=0,t=this._initializers.length;e<t;e++)this._initializers[e].call(this)},_resetView:function(t,n,r,i){var s=this._zoom!==n;i||(this.fire("movestart"),s&&this.fire("zoomstart")),this._zoom=n,this._initialTopLeftPoint=this._getNewTopLeftPoint(t),r?this._initialTopLeftPoint._add(e.DomUtil.getPosition(this._mapPane)):e.DomUtil.setPosition(this._mapPane,new e.Point(0,0)),this._tileLayersToLoad=this._tileLayersNum,this.fire("viewreset",{hard:!r}),this.fire("move"),(s||i)&&this.fire("zoomend"),this.fire("moveend"),this._loaded||(this._loaded=!0,this.fire("load"))},_initLayers:function(e){e=e?e instanceof Array?e:[e]:[],this._layers={},this._tileLayersNum=0;var t,n;for(t=0,n=e.length;t<n;t++)this.addLayer(e[t])},_rawPanBy:function(t){var n=e.DomUtil.getPosition(this._mapPane).subtract(t);e.DomUtil.setPosition(this._mapPane,n)},_initEvents:function(){if(!e.DomEvent)return;e.DomEvent.addListener(this._container,"click",this._onMouseClick,this);var t=["dblclick","mousedown","mouseenter","mouseleave","mousemove","contextmenu"],n,r;for(n=0,r=t.length;n<r;n++)e.DomEvent.addListener(this._container,t[n],this._fireMouseEvent,this);this.options.trackResize&&e.DomEvent.addListener(window,"resize",this._onResize,this)},_onResize:function(){e.Util.requestAnimFrame(this.invalidateSize,this,!1,this._container)},_onMouseClick:function(e){if(!this._loaded||this.dragging&&this.dragging.moved())return;this.fire("pre"+e.type),this._fireMouseEvent(e)},_fireMouseEvent:function(t){if(!this._loaded)return;var n=t.type;n=n==="mouseenter"?"mouseover":n==="mouseleave"?"mouseout":n;if(!this.hasEventListeners(n))return;n==="contextmenu"&&e.DomEvent.preventDefault(t);var r=this.mouseEventToContainerPoint(t),i=this.containerPointToLayerPoint(r),s=this.layerPointToLatLng(i);this.fire(n,{latlng:s,layerPoint:i,containerPoint:r,originalEvent:t})},_onTileLayerLoad:function(){this._tileLayersToLoad--,this._tileLayersNum&&!this._tileLayersToLoad&&this._tileBg&&(clearTimeout(this._clearTileBgTimer),this._clearTileBgTimer=setTimeout(e.Util.bind(this._clearTileBg,this),500))},_getTopLeftPoint:function(){if(!this._loaded)throw Error("Set map center and zoom first.");var t=e.DomUtil.getPosition(this._mapPane);return this._initialTopLeftPoint.subtract(t)},_getNewTopLeftPoint:function(e){var t=this.getSize().divideBy(2);return this.project(e)._subtract(t)._round()},_limitZoom:function(e){var t=this.getMinZoom(),n=this.getMaxZoom();return Math.max(t,Math.min(n,e))}}),e.Map.addInitHook=function(e){var t=Array.prototype.slice.call(arguments,1),n=typeof e=="function"?e:function(){this[e].apply(this,t)};this.prototype._initializers.push(n)},e.Projection.Mercator={MAX_LATITUDE:85.0840591556,R_MINOR:6356752.3142,R_MAJOR:6378137,project:function(t){var n=e.LatLng.DEG_TO_RAD,r=this.MAX_LATITUDE,i=Math.max(Math.min(r,t.lat),-r),s=this.R_MAJOR,o=this.R_MINOR,u=t.lng*n*s,a=i*n,f=o/s,l=Math.sqrt(1-f*f),c=l*Math.sin(a);c=Math.pow((1-c)/(1+c),l*.5);var h=Math.tan(.5*(Math.PI*.5-a))/c;return a=-o*Math.log(h),new e.Point(u,a)},unproject:function(t,n){var r=e.LatLng.RAD_TO_DEG,i=this.R_MAJOR,s=this.R_MINOR,o=t.x*r/i,u=s/i,a=Math.sqrt(1-u*u),f=Math.exp(-t.y/s),l=Math.PI/2-2*Math.atan(f),c=15,h=1e-7,p=c,d=.1,v;while(Math.abs(d)>h&&--p>0)v=a*Math.sin(l),d=Math.PI/2-2*Math.atan(f*Math.pow((1-v)/(1+v),.5*a))-l,l+=d;return new e.LatLng(l*r,o,n)}},e.CRS.EPSG3395=e.Util.extend({},e.CRS,{code:"EPSG:3395",projection:e.Projection.Mercator,transformation:function(){var t=e.Projection.Mercator,n=t.R_MAJOR,r=t.R_MINOR;return new e.Transformation(.5/(Math.PI*n),.5,-0.5/(Math.PI*r),.5)}()}),e.TileLayer=e.Class.extend({includes:e.Mixin.Events,options:{minZoom:0,maxZoom:18,tileSize:256,subdomains:"abc",errorTileUrl:"",attribution:"",opacity:1,scheme:"xyz",continuousWorld:!1,noWrap:!1,zoomOffset:0,zoomReverse:!1,detectRetina:!1,unloadInvisibleTiles:e.Browser.mobile,updateWhenIdle:e.Browser.mobile,reuseTiles:!1},initialize:function(t,n){n=e.Util.setOptions(this,n),n.detectRetina&&window.devicePixelRatio>1&&n.maxZoom>0&&(n.tileSize=Math.floor(n.tileSize/2),n.zoomOffset++,n.minZoom>0&&n.minZoom--,this.options.maxZoom--),this._url=t;var r=this.options.subdomains;typeof r=="string"&&(this.options.subdomains=r.split(""))},onAdd:function(t,n){this._map=t,this._insertAtTheBottom=n,this._initContainer(),this._createTileProto(),t.on("viewreset",this._resetCallback,this),t.on("moveend",this._update,this),this.options.updateWhenIdle||(this._limitedUpdate=e.Util.limitExecByInterval(this._update,150,this),t.on("move",this._limitedUpdate,this)),this._reset(),this._update()},onRemove:function(e){e._panes.tilePane.removeChild(this._container),e.off("viewreset",this._resetCallback,this),e.off("moveend",this._update,this),this.options.updateWhenIdle||e.off("move",this._limitedUpdate,this),this._container=null,this._map=null},getAttribution:function(){return this.options.attribution},setOpacity:function(t){this.options.opacity=t,this._map&&this._updateOpacity();var n,r=this._tiles;if(e.Browser.webkit)for(n in r)r.hasOwnProperty(n)&&(r[n].style.webkitTransform+=" translate(0,0)")},_updateOpacity:function(){e.DomUtil.setOpacity(this._container,this.options.opacity)},_initContainer:function(){var t=this._map._panes.tilePane,n=t.firstChild;if(!this._container||t.empty)this._container=e.DomUtil.create("div","leaflet-layer"),this._insertAtTheBottom&&n?t.insertBefore(this._container,n):t.appendChild(this._container),this.options.opacity<1&&this._updateOpacity()},_resetCallback:function(e){this._reset(e.hard)},_reset:function(e){var t,n=this._tiles;for(t in n)n.hasOwnProperty(t)&&this.fire("tileunload",{tile:n[t]});this._tiles={},this.options.reuseTiles&&(this._unusedTiles=[]),e&&this._container&&(this._container.innerHTML=""),this._initContainer()},_update:function(t){if(this._map._panTransition&&this._map._panTransition._inProgress)return;var n=this._map.getPixelBounds(),r=this._map.getZoom(),i=this.options.tileSize;if(r>this.options.maxZoom||r<this.options.minZoom)return;var s=new e.Point(Math.floor(n.min.x/i),Math.floor(n.min.y/i)),o=new e.Point(Math.floor(n.max.x/i),Math.floor(n.max.y/i)),u=new e.Bounds(s,o);this._addTilesFromCenterOut(u),(this.options.unloadInvisibleTiles||this.options.reuseTiles)&&this._removeOtherTiles(u)},_addTilesFromCenterOut:function(t){var n=[],r=t.getCenter(),i,s;for(i=t.min.y;i<=t.max.y;i++)for(s=t.min.x;s<=t.max.x;s++)s+":"+i in this._tiles||n.push(new e.Point(s,i));n.sort(function(e,t){return e.distanceTo(r)-t.distanceTo(r)});var o=document.createDocumentFragment();this._tilesToLoad=n.length;var u,a;for(u=0,a=this._tilesToLoad;u<a;u++)this._addTile(n[u],o);this._container.appendChild(o)},_removeOtherTiles:function(e){var t,n,r,i,s;for(i in this._tiles)this._tiles.hasOwnProperty(i)&&(t=i.split(":"),n=parseInt(t[0],10),r=parseInt(t[1],10),(n<e.min.x||n>e.max.x||r<e.min.y||r>e.max.y)&&this._removeTile(i))},_removeTile:function(t){var n=this._tiles[t];this.fire("tileunload",{tile:n,url:n.src}),n.parentNode===this._container&&this._container.removeChild(n),this.options.reuseTiles&&this._unusedTiles.push(n),n.src=e.Util.emptyImageUrl,delete this._tiles[t]},_addTile:function(t,n){var r=this._getTilePos(t),i=this._map.getZoom(),s=t.x+":"+t.y,o=Math.pow(2,this._getOffsetZoom(i));if(!this.options.continuousWorld){if(!this.options.noWrap)t.x=(t.x%o+o)%o;else if(t.x<0||t.x>=o){this._tilesToLoad--;return}if(t.y<0||t.y>=o){this._tilesToLoad--;return}}var u=this._getTile();e.DomUtil.setPosition(u,r),this._tiles[s]=u,this.options.scheme==="tms"&&(t.y=o-t.y-1),this._loadTile(u,t,i),n.appendChild(u)},_getOffsetZoom:function(e){var t=this.options;return e=t.zoomReverse?t.maxZoom-e:e,e+t.zoomOffset},_getTilePos:function(e){var t=this._map.getPixelOrigin(),n=this.options.tileSize;return e.multiplyBy(n).subtract(t)},getTileUrl:function(t,n){var r=this.options.subdomains,i=(t.x+t.y)%r.length,s=this.options.subdomains[i];return e.Util.template(this._url,e.Util.extend({s:s,z:this._getOffsetZoom(n),x:t.x,y:t.y},this.options))},_createTileProto:function(){var t=this._tileImg=e.DomUtil.create("img","leaflet-tile");t.galleryimg="no";var n=this.options.tileSize;t.style.width=n+"px",t.style.height=n+"px"},_getTile:function(){if(this.options.reuseTiles&&this._unusedTiles.length>0){var e=this._unusedTiles.pop();return this._resetTile(e),e}return this._createTile()},_resetTile:function(e){},_createTile:function(){var t=this._tileImg.cloneNode(!1);return t.onselectstart=t.onmousemove=e.Util.falseFn,t},_loadTile:function(e,t,n){e._layer=this,e.onload=this._tileOnLoad,e.onerror=this._tileOnError,e.src=this.getTileUrl(t,n)},_tileLoaded:function(){this._tilesToLoad--,this._tilesToLoad||this.fire("load")},_tileOnLoad:function(e){var t=this._layer;this.className+=" leaflet-tile-loaded",t.fire("tileload",{tile:this,url:this.src}),t._tileLoaded()},_tileOnError:function(e){var t=this._layer;t.fire("tileerror",{tile:this,url:this.src});var n=t.options.errorTileUrl;n&&(this.src=n),t._tileLoaded()}}),e.TileLayer.WMS=e.TileLayer.extend({defaultWmsParams:{service:"WMS",request:"GetMap",version:"1.1.1",layers:"",styles:"",format:"image/jpeg",transparent:!1},initialize:function(t,n){this._url=t;var r=e.Util.extend({},this.defaultWmsParams);r.width=r.height=this.options.tileSize;for(var i in n)this.options.hasOwnProperty(i)||(r[i]=n[i]);this.wmsParams=r,e.Util.setOptions(this,n)},onAdd:function(t,n){var r=parseFloat(this.wmsParams.version)>=1.3?"crs":"srs";this.wmsParams[r]=t.options.crs.code,e.TileLayer.prototype.onAdd.call(this,t,n)},getTileUrl:function(t,n){var r=this._map,i=r.options.crs,s=this.options.tileSize,o=t.multiplyBy(s),u=o.add(new e.Point(s,s)),a=r.unproject(o,n,!0),f=r.unproject(u,n,!0),l=i.project(a),c=i.project(f),h=[l.x,c.y,c.x,l.y].join(",");return this._url+e.Util.getParamString(this.wmsParams)+"&bbox="+h}}),e.TileLayer.Canvas=e.TileLayer.extend({options:{async:!1},initialize:function(t){e.Util.setOptions(this,t)},redraw:function(){var e,t=this._tiles;for(e in t)t.hasOwnProperty(e)&&this._redrawTile(t[e])},_redrawTile:function(e){this.drawTile(e,e._tilePoint,e._zoom)},_createTileProto:function(){var t=this._canvasProto=e.DomUtil.create("canvas","leaflet-tile"),n=this.options.tileSize;t.width=n,t.height=n},_createTile:function(){var t=this._canvasProto.cloneNode(!1);return t.onselectstart=t.onmousemove=e.Util.falseFn,t},_loadTile:function(e,t,n){e._layer=this,e._tilePoint=t,e._zoom=n,this.drawTile(e,t,n),this.options.async||this.tileDrawn(e)},drawTile:function(e,t,n){},tileDrawn:function(e){this._tileOnLoad.call(e)}}),e.ImageOverlay=e.Class.extend({includes:e.Mixin.Events,initialize:function(e,t){this._url=e,this._bounds=t},onAdd:function(e){this._map=e,this._image||this._initImage(),e._panes.overlayPane.appendChild(this._image),e.on("viewreset",this._reset,this),this._reset()},onRemove:function(e){e.getPanes().overlayPane.removeChild(this._image),e.off("viewreset",this._reset,this)},_initImage:function(){this._image=e.DomUtil.create("img","leaflet-image-layer"),this._image.style.visibility="hidden",e.Util.extend(this._image,{galleryimg:"no",onselectstart:e.Util.falseFn,onmousemove:e.Util.falseFn,onload:e.Util.bind(this._onImageLoad,this),src:this._url})},_reset:function(){var t=this._image,n=this._map.latLngToLayerPoint(this._bounds.getNorthWest()),r=this._map.latLngToLayerPoint(this._bounds.getSouthEast()).subtract(n);e.DomUtil.setPosition(t,n),t.style.width=r.x+"px",t.style.height=r.y+"px"},_onImageLoad:function(){this._image.style.visibility="",this.fire("load")}}),e.Icon=e.Class.extend({options:{className:""},initialize:function(t){e.Util.setOptions(this,t)},createIcon:function(){return this._createIcon("icon")},createShadow:function(){return this._createIcon("shadow")},_createIcon:function(e){var t=this._getIconUrl(e);if(!t)return null;var n=this._createImg(t);return this._setIconStyles(n,e),n},_setIconStyles:function(e,t){var n=this.options,r=n[t+"Size"],i=n.iconAnchor;!i&&r&&(i=r.divideBy(2,!0)),t==="shadow"&&i&&n.shadowOffset&&i._add(n.shadowOffset),e.className="leaflet-marker-"+t+" "+n.className,i&&(e.style.marginLeft=-i.x+"px",e.style.marginTop=-i.y+"px"),r&&(e.style.width=r.x+"px",e.style.height=r.y+"px")},_createImg:function(t){var n;return e.Browser.ie6?(n=document.createElement("div"),n.style.filter='progid:DXImageTransform.Microsoft.AlphaImageLoader(src="'+t+'")'):(n=document.createElement("img"),n.src=t),n},_getIconUrl:function(e){return this.options[e+"Url"]}}),e.Icon.Default=e.Icon.extend({options:{iconSize:new e.Point(25,41),iconAnchor:new e.Point(13,41),popupAnchor:new e.Point(0,-33),shadowSize:new e.Point(41,41)},_getIconUrl:function(t){var n=e.Icon.Default.imagePath;if(!n)throw Error("Couldn't autodetect L.Icon.Default.imagePath, set it manually.");return n+"/marker-"+t+".png"}}),e.Icon.Default.imagePath=function(){var e=document.getElementsByTagName("script"),t=/\/?leaflet[\-\._]?([\w\-\._]*)\.js\??/,n,r,i,s;for(n=0,r=e.length;n<r;n++){i=e[n].src,s=i.match(t);if(s)return i.split(t)[0]+"/images"}}(),e.Marker=e.Class.extend({includes:e.Mixin.Events,options:{icon:new e.Icon.Default,title:"",clickable:!0,draggable:!1,zIndexOffset:0,opacity:1},initialize:function(t,n){e.Util.setOptions(this,n),this._latlng=t},onAdd:function(e){this._map=e,e.on("viewreset",this._reset,this),this._initIcon(),this._reset()},onRemove:function(e){this._removeIcon(),this.closePopup&&this.closePopup(),e.off("viewreset",this._reset,this),this._map=null},getLatLng:function(){return this._latlng},setLatLng:function(e){this._latlng=e,this._reset(),this._popup&&this._popup.setLatLng(e)},setZIndexOffset:function(e){this.options.zIndexOffset=e,this._reset()},setIcon:function(e){this._map&&this._removeIcon(),this.options.icon=e,this._map&&(this._initIcon(),this._reset())},_initIcon:function(){var e=this.options;this._icon||(this._icon=e.icon.createIcon(),e.title&&(this._icon.title=e.title),this._initInteraction(),this._updateOpacity()),this._shadow||(this._shadow=e.icon.createShadow());var t=this._map._panes;t.markerPane.appendChild(this._icon),this._shadow&&t.shadowPane.appendChild(this._shadow)},_removeIcon:function(){var e=this._map._panes;e.markerPane.removeChild(this._icon),this._shadow&&e.shadowPane.removeChild(this._shadow),this._icon=this._shadow=null},_reset:function(){var t=this._icon;if(!t)return;var n=this._map.latLngToLayerPoint(this._latlng).round();e.DomUtil.setPosition(t,n),this._shadow&&e.DomUtil.setPosition(this._shadow,n),t.style.zIndex=n.y+this.options.zIndexOffset},_initInteraction:function(){if(!this.options.clickable)return;var t=this._icon,n=["dblclick","mousedown","mouseover","mouseout"];t.className+=" leaflet-clickable",e.DomEvent.addListener(t,"click",this._onMouseClick,this);for(var r=0;r<n.length;r++)e.DomEvent.addListener(t,n[r],this._fireMouseEvent,this);e.Handler.MarkerDrag&&(this.dragging=new e.Handler.MarkerDrag(this),this.options.draggable&&this.dragging.enable())},_onMouseClick:function(t){e.DomEvent.stopPropagation(t);if(this.dragging&&this.dragging.moved())return;if(this._map.dragging&&this._map.dragging.moved())return;this.fire(t.type,{originalEvent:t})},_fireMouseEvent:function(t){this.fire(t.type,{originalEvent:t}),t.type!=="mousedown"&&e.DomEvent.stopPropagation(t)},setOpacity:function(e){this.options.opacity=e,this._map&&this._updateOpacity()},_updateOpacity:function(t){e.DomUtil.setOpacity(this._icon,this.options.opacity)}}),e.DivIcon=e.Icon.extend({options:{iconSize:new e.Point(12,12),className:"leaflet-div-icon"},createIcon:function(){var e=document.createElement("div");return this._setIconStyles(e,"icon"),e},createShadow:function(){return null}}),e.Map.mergeOptions({closePopupOnClick:!0}),e.Popup=e.Class.extend({includes:e.Mixin.Events,options:{minWidth:50,maxWidth:300,maxHeight:null,autoPan:!0,closeButton:!0,offset:new e.Point(0,2),autoPanPadding:new e.Point(5,5),className:""},initialize:function(t,n){e.Util.setOptions(this,t),this._source=n},onAdd:function(e){this._map=e,this._container||this._initLayout(),this._updateContent(),this._container.style.opacity="0",e._panes.popupPane.appendChild(this._container),e.on("viewreset",this._updatePosition,this),e.options.closePopupOnClick&&e.on("preclick",this._close,this),this._update(),this._container.style.opacity="1"},onRemove:function(t){t._panes.popupPane.removeChild(this._container),e.Util.falseFn(this._container.offsetWidth),t.off("viewreset",this._updatePosition,this).off("preclick",this._close,this),this._container.style.opacity="0",this._map=null},setLatLng:function(e){return this._latlng=e,this._update(),this},setContent:function(e){return this._content=e,this._update(),this},_close:function(){var e=this._map;e&&(e._popup=null,e.removeLayer(this).fire("popupclose",{popup:this}))},_initLayout:function(){var t="leaflet-popup",n=this._container=e.DomUtil.create("div",t+" "+this.options.className),r;this.options.closeButton&&(r=this._closeButton=e.DomUtil.create("a",t+"-close-button",n),r.href="#close",e.DomEvent.addListener(r,"click",this._onCloseButtonClick,this));var i=this._wrapper=e.DomUtil.create("div",t+"-content-wrapper",n);e.DomEvent.disableClickPropagation(i),this._contentNode=e.DomUtil.create("div",t+"-content",i),e.DomEvent.addListener(this._contentNode,"mousewheel",e.DomEvent.stopPropagation),this._tipContainer=e.DomUtil.create("div",t+"-tip-container",n),this._tip=e.DomUtil.create("div",t+"-tip",this._tipContainer)},_update:function(){if(!this._map)return;this._container.style.visibility="hidden",this._updateContent(),this._updateLayout(),this._updatePosition(),this._container.style.visibility="",this._adjustPan()},_updateContent:function(){if(!this._content)return;typeof this._content=="string"?this._contentNode.innerHTML=this._content:(this._contentNode.innerHTML="",this._contentNode.appendChild(this._content)),this.fire("contentupdate")},_updateLayout:function(){var e=this._contentNode;e.style.width="",e.style.whiteSpace="nowrap";var t=e.offsetWidth;t=Math.min(t,this.options.maxWidth),t=Math.max(t,this.options.minWidth),e.style.width=t+1+"px",e.style.whiteSpace="",e.style.height="";var n=e.offsetHeight,r=this.options.maxHeight,i=" leaflet-popup-scrolled";r&&n>r?(e.style.height=r+"px",e.className+=i):e.className=e.className.replace(i,""),this._containerWidth=this._container.offsetWidth},_updatePosition:function(){var e=this._map.latLngToLayerPoint(this._latlng);this._containerBottom=-e.y-this.options.offset.y,this._containerLeft=e.x-Math.round(this._containerWidth/2)+this.options.offset.x,this._container.style.bottom=this._containerBottom+"px",this._container.style.left=this._containerLeft+"px"},_adjustPan:function(){if(!this.options.autoPan)return;var t=this._map,n=this._container.offsetHeight,r=this._containerWidth,i=new e.Point(this._containerLeft,-n-this._containerBottom),s=t.layerPointToContainerPoint(i),o=new e.Point(0,0),u=this.options.autoPanPadding,a=t.getSize();s.x<0&&(o.x=s.x-u.x),s.x+r>a.x&&(o.x=s.x+r-a.x+u.x),s.y<0&&(o.y=s.y-u.y),s.y+n>a.y&&(o.y=s.y+n-a.y+u.y),(o.x||o.y)&&t.panBy(o)},_onCloseButtonClick:function(t){this._close(),e.DomEvent.stop(t)}}),e.Marker.include({openPopup:function(){return this._popup&&this._map&&(this._popup.setLatLng(this._latlng),this._map.openPopup(this._popup)),this},closePopup:function(){return this._popup&&this._popup._close(),this},bindPopup:function(t,n){var r=this.options.icon.options.popupAnchor||new e.Point(0,0);return n&&n.offset&&(r=r.add(n.offset)),n=e.Util.extend({offset:r},n),this._popup||this.on("click",this.openPopup,this),this._popup=(new e.Popup(n,this)).setContent(t),this},unbindPopup:function(){return this._popup&&(this._popup=null,this.off("click",this.openPopup)),this}}),e.Map.include({openPopup:function(e){return this.closePopup(),this._popup=e,this.addLayer(e).fire("popupopen",{popup:this._popup})},closePopup:function(){return this._popup&&this._popup._close(),this}}),e.LayerGroup=e.Class.extend({initialize:function(e){this._layers={};var t,n;if(e)for(t=0,n=e.length;t<n;t++)this.addLayer(e[t])},addLayer:function(t){var n=e.Util.stamp(t);return this._layers[n]=t,this._map&&this._map.addLayer(t),this},removeLayer:function(t){var n=e.Util.stamp(t);return delete this._layers[n],this._map&&this._map.removeLayer(t),this},clearLayers:function(){return this._iterateLayers(this.removeLayer,this),this},invoke:function(e){var t=Array.prototype.slice.call(arguments,1),n,r;for(n in this._layers)this._layers.hasOwnProperty(n)&&(r=this._layers[n],r[e]&&r[e].apply(r,t));return this},onAdd:function(e){this._map=e,this._iterateLayers(e.addLayer,e)},onRemove:function(e){this._iterateLayers(e.removeLayer,e),this._map=null},_iterateLayers:function(e,t){for(var n in this._layers)this._layers.hasOwnProperty(n)&&e.call(t,this._layers[n])}}),e.FeatureGroup=e.LayerGroup.extend({includes:e.Mixin.Events,addLayer:function(t){this._initEvents(t),e.LayerGroup.prototype.addLayer.call(this,t),this._popupContent&&t.bindPopup&&t.bindPopup(this._popupContent)},bindPopup:function(e){return this._popupContent=e,this.invoke("bindPopup",e)},setStyle:function(e){return this.invoke("setStyle",e)},getBounds:function(){var t=new e.LatLngBounds;return this._iterateLayers(function(n){t.extend(n instanceof e.Marker?n.getLatLng():n.getBounds())},this),t},_initEvents:function(e){var t=["click","dblclick","mouseover","mouseout"],n,r;for(n=0,r=t.length;n<r;n++)e.on(t[n],this._propagateEvent,this)},_propagateEvent:function(e){e.layer=e.target,e.target=this,this.fire(e.type,e)}}),e.Path=e.Class.extend({includes:[e.Mixin.Events],statics:{CLIP_PADDING:.5},options:{stroke:!0,color:"#0033ff",weight:5,opacity:.5,fill:!1,fillColor:null,fillOpacity:.2,clickable:!0},initialize:function(t){e.Util.setOptions(this,t)},onAdd:function(e){this._map=e,this._initElements(),this._initEvents(),this.projectLatlngs(),this._updatePath(),e.on("viewreset",this.projectLatlngs,this).on("moveend",this._updatePath,this)},onRemove:function(e){this._map=null,e._pathRoot.removeChild(this._container),e.off("viewreset",this.projectLatlngs,this).off("moveend",this._updatePath,this)},projectLatlngs:function(){},setStyle:function(t){return e.Util.setOptions(this,t),this._container&&this._updateStyle(),this},redraw:function(){return this._map&&(this.projectLatlngs(),this._updatePath()),this}}),e.Map.include({_updatePathViewport:function(){var t=e.Path.CLIP_PADDING,n=this.getSize(),r=e.DomUtil.getPosition(this._mapPane),i=r.multiplyBy(-1)._subtract(n.multiplyBy(t)),s=i.add(n.multiplyBy(1+t*2));this._pathViewport=new e.Bounds(i,s)}}),e.Path.SVG_NS="http://www.w3.org/2000/svg",e.Browser.svg=!!document.createElementNS&&!!document.createElementNS(e.Path.SVG_NS,"svg").createSVGRect,e.Path=e.Path.extend({statics:{SVG:e.Browser.svg},getPathString:function(){},_createElement:function(t){return document.createElementNS(e.Path.SVG_NS,t)},_initElements:function(){this._map._initPathRoot(),this._initPath(),this._initStyle()},_initPath:function(){this._container=this._createElement("g"),this._path=this._createElement("path"),this._container.appendChild(this._path),this._map._pathRoot.appendChild(this._container)},_initStyle:function(){this.options.stroke&&(this._path.setAttribute("stroke-linejoin","round"),this._path.setAttribute("stroke-linecap","round")),this.options.fill&&this._path.setAttribute("fill-rule","evenodd"),this._updateStyle()},_updateStyle:function(){this.options.stroke?(this._path.setAttribute("stroke",this.options.color),this._path.setAttribute("stroke-opacity",this.options.opacity),this._path.setAttribute("stroke-width",this.options.weight)):this._path.setAttribute("stroke","none"),this.options.fill?(this._path.setAttribute("fill",this.options.fillColor||this.options.color),this._path.setAttribute("fill-opacity",this.options.fillOpacity)):this._path.setAttribute("fill","none")},_updatePath:function(){var e=this.getPathString();e||(e="M0 0"),this._path.setAttribute("d",e)},_initEvents:function(){if(this.options.clickable){(e.Browser.svg||!e.Browser.vml)&&this._path.setAttribute("class","leaflet-clickable"),e.DomEvent.addListener(this._container,"click",this._onMouseClick,this);var t=["dblclick","mousedown","mouseover","mouseout","mousemove","contextmenu"];for(var n=0;n<t.length;n++)e.DomEvent.addListener(this._container,t[n],this._fireMouseEvent,this)}},_onMouseClick:function(t){if(this._map.dragging&&this._map.dragging.moved())return;t.type==="contextmenu"&&e.DomEvent.preventDefault(t),this._fireMouseEvent(t)},_fireMouseEvent:function(t){if(!this.hasEventListeners(t.type))return;var n=this._map,r=n.mouseEventToContainerPoint(t),i=n.containerPointToLayerPoint(r),s=n.layerPointToLatLng(i);this.fire(t.type,{latlng:s,layerPoint:i,containerPoint:r,originalEvent:t}),e.DomEvent.stopPropagation(t)}}),e.Map.include({_initPathRoot:function(){this._pathRoot||(this._pathRoot=e.Path.prototype._createElement("svg"),this._panes.overlayPane.appendChild(this._pathRoot),this.on("moveend",this._updateSvgViewport),this._updateSvgViewport())},_updateSvgViewport:function(){this._updatePathViewport();var t=this._pathViewport,n=t.min,r=t.max,i=r.x-n.x,s=r.y-n.y,o=this._pathRoot,u=this._panes.overlayPane;e.Browser.webkit&&u.removeChild(o),e.DomUtil.setPosition(o,n),o.setAttribute("width",i),o.setAttribute("height",s),o.setAttribute("viewBox",[n.x,n.y,i,s].join(" ")),e.Browser.webkit&&u.appendChild(o)}}),e.Path.include({bindPopup:function(t,n){if(!this._popup||this._popup.options!==n)this._popup=new e.Popup(n,this);return this._popup.setContent(t),this._openPopupAdded||(this.on("click",this._openPopup,this),this._openPopupAdded=!0),this},_openPopup:function(e){this._popup.setLatLng(e.latlng),this._map.openPopup(this._popup)}}),e.Browser.vml=function(){var e=document.createElement("div");e.innerHTML='<v:shape adj="1"/>';var t=e.firstChild;return t.style.behavior="url(#default#VML)",t&&typeof t.adj=="object"}(),e.Path=e.Browser.svg||!e.Browser.vml?e.Path:e.Path.extend({statics:{VML:!0,CLIP_PADDING:.02},_createElement:function(){try{return document.namespaces.add("lvml","urn:schemas-microsoft-com:vml"),function(e){return document.createElement("<lvml:"+e+' class="lvml">')}}catch(e){return function(e){return document.createElement("<"+e+' xmlns="urn:schemas-microsoft.com:vml" class="lvml">')}}}(),_initPath:function(){var e=this._container=this._createElement("shape");e.className+=" leaflet-vml-shape"+(this.options.clickable?" leaflet-clickable":""),e.coordsize="1 1",this._path=this._createElement("path"),e.appendChild(this._path),this._map._pathRoot.appendChild(e)},_initStyle:function(){var e=this._container,t,n;this.options.stroke&&(t=this._stroke=this._createElement("stroke"),t.endcap="round",e.appendChild(t)),this.options.fill&&(n=this._fill=this._createElement("fill"),e.appendChild(n)),this._updateStyle()},_updateStyle:function(){var e=this._stroke,t=this._fill,n=this.options,r=this._container;r.stroked=n.stroke,r.filled=n.fill,n.stroke&&(e.weight=n.weight+"px",e.color=n.color,e.opacity=n.opacity),n.fill&&(t.color=n.fillColor||n.color,t.opacity=n.fillOpacity)},_updatePath:function(){var e=this._container.style;e.display="none",this._path.v=this.getPathString()+" ",e.display=""}}),e.Map.include(e.Browser.svg||!e.Browser.vml?{}:{_initPathRoot:function(){if(this._pathRoot)return;var e=this._pathRoot=document.createElement("div");e.className="leaflet-vml-container",this._panes.overlayPane.appendChild(e),this.on("moveend",this._updatePathViewport),this._updatePathViewport()}}),e.Browser.canvas=function(){return!!document.createElement("canvas").getContext}(),e.Path=e.Path.SVG&&!window.L_PREFER_CANVAS||!e.Browser.canvas?e.Path:e.Path.extend({statics:{CANVAS:!0,SVG:!1},_initElements:function(){this._map._initPathRoot(),this._ctx=this._map._canvasCtx},_updateStyle:function(){var e=this.options;e.stroke&&(this._ctx.lineWidth=e.weight,this._ctx.strokeStyle=e.color),e.fill&&(this._ctx.fillStyle=e.fillColor||e.color)},_drawPath:function(){var t,n,r,i,s,o;this._ctx.beginPath();for(t=0,r=this._parts.length;t<r;t++){for(n=0,i=this._parts[t].length;n<i;n++)s=this._parts[t][n],o=(n===0?"move":"line")+"To",this._ctx[o](s.x,s.y);this instanceof e.Polygon&&this._ctx.closePath()}},_checkIfEmpty:function(){return!this._parts.length},_updatePath:function(){if(this._checkIfEmpty())return;var e=this._ctx,t=this.options;this._drawPath(),e.save(),this._updateStyle(),t.fill&&(t.fillOpacity<1&&(e.globalAlpha=t.fillOpacity),e.fill()),t.stroke&&(t.opacity<1&&(e.globalAlpha=t.opacity),e.stroke()),e.restore()},_initEvents:function(){this.options.clickable&&this._map.on("click",this._onClick,this)},_onClick:function(e){this._containsPoint(e.layerPoint)&&this.fire("click",e)},onRemove:function(e){e.off("viewreset",this._projectLatlngs,this).off("moveend",this._updatePath,this).fire("moveend")}}),e.Map.include(e.Path.SVG&&!window.L_PREFER_CANVAS||!e.Browser.canvas?{}:{_initPathRoot:function(){var e=this._pathRoot,t;e||(e=this._pathRoot=document.createElement("canvas"),e.style.position="absolute",t=this._canvasCtx=e.getContext("2d"),t.lineCap="round",t.lineJoin="round",this._panes.overlayPane.appendChild(e),this.on("moveend",this._updateCanvasViewport),this._updateCanvasViewport())},_updateCanvasViewport:function(){this._updatePathViewport();var t=this._pathViewport,n=t.min,r=t.max.subtract(n),i=this._pathRoot;e.DomUtil.setPosition(i,n),i.width=r.x,i.height=r.y,i.getContext("2d").translate(-n.x,-n.y)}}),e.LineUtil={simplify:function(e,t){if(!t||!e.length)return e.slice();var n=t*t;return e=this._reducePoints(e,n),e=this._simplifyDP(e,n),e},pointToSegmentDistance:function(e,t,n){return Math.sqrt(this._sqClosestPointOnSegment(e,t,n,!0))},closestPointOnSegment:function(e,t,n){return this._sqClosestPointOnSegment(e,t,n)},_simplifyDP:function(e,t){var n=e.length,r=typeof Uint8Array!="undefined"?Uint8Array:Array,i=new r(n);i[0]=i[n-1]=1,this._simplifyDPStep(e,i,t,0,n-1);var s,o=[];for(s=0;s<n;s++)i[s]&&o.push(e[s]);return o},_simplifyDPStep:function(e,t,n,r,i){var s=0,o,u,a;for(u=r+1;u<=i-1;u++)a=this._sqClosestPointOnSegment(e[u],e[r],e[i],!0),a>s&&(o=u,s=a);s>n&&(t[o]=1,this._simplifyDPStep(e,t,n,r,o),this._simplifyDPStep(e,t,n,o,i))},_reducePoints:function(e,t){var n=[e[0]];for(var r=1,i=0,s=e.length;r<s;r++)this._sqDist(e[r],e[i])>t&&(n.push(e[r]),i=r);return i<s-1&&n.push(e[s-1]),n},clipSegment:function(e,t,n,r){var i=n.min,s=n.max,o=r?this._lastCode:this._getBitCode(e,n),u=this._getBitCode(t,n);this._lastCode=u;for(;;){if(!(o|u))return[e,t];if(o&u)return!1;var a=o||u,f=this._getEdgeIntersection(e,t,a,n),l=this._getBitCode(f,n);a===o?(e=f,o=l):(t=f,u=l)}},_getEdgeIntersection:function(t,n,r,i){var s=n.x-t.x,o=n.y-t.y,u=i.min,a=i.max;if(r&8)return new e.Point(t.x+s*(a.y-t.y)/o,a.y);if(r&4)return new e.Point(t.x+s*(u.y-t.y)/o,u.y);if(r&2)return new e.Point(a.x,t.y+o*(a.x-t.x)/s);if(r&1)return new e.Point(u.x,t.y+o*(u.x-t.x)/s)},_getBitCode:function(e,t){var n=0;return e.x<t.min.x?n|=1:e.x>t.max.x&&(n|=2),e.y<t.min.y?n|=4:e.y>t.max.y&&(n|=8),n},_sqDist:function(e,t){var n=t.x-e.x,r=t.y-e.y;return n*n+r*r},_sqClosestPointOnSegment:function(t,n,r,i){var s=n.x,o=n.y,u=r.x-s,a=r.y-o,f=u*u+a*a,l;return f>0&&(l=((t.x-s)*u+(t.y-o)*a)/f,l>1?(s=r.x,o=r.y):l>0&&(s+=u*l,o+=a*l)),u=t.x-s,a=t.y-o,i?u*u+a*a:new e.Point(s,o)}},e.Polyline=e.Path.extend({initialize:function(t,n){e.Path.prototype.initialize.call(this,n),this._latlngs=t,e.Handler.PolyEdit&&(this.editing=new e.Handler.PolyEdit(this),this.options.editable&&this.editing.enable())},options:{smoothFactor:1,noClip:!1},projectLatlngs:function(){this._originalPoints=[];for(var e=0,t=this._latlngs.length;e<t;e++)this._originalPoints[e]=this._map.latLngToLayerPoint(this._latlngs[e])},getPathString:function(){for(var e=0,t=this._parts.length,n="";e<t;e++)n+=this._getPathPartStr(this._parts[e]);return n},getLatLngs:function(){return this._latlngs},setLatLngs:function(e){return this._latlngs=e,this.redraw()},addLatLng:function(e){return this._latlngs.push(e),this.redraw()},spliceLatLngs:function(e,t){var n=[].splice.apply(this._latlngs,arguments);return this.redraw(),n},closestLayerPoint:function(t){var n=Infinity,r=this._parts,i,s,o=null;for(var u=0,a=r.length;u<a;u++){var f=r[u];for(var l=1,c=f.length;l<c;l++){i=f[l-1],s=f[l];var h=e.LineUtil._sqClosestPointOnSegment(t,i,s);h._sqDist<n&&(n=h._sqDist,o=h)}}return o&&(o.distance=Math.sqrt(n)),o},getBounds:function(){var t=new e.LatLngBounds,n=this.getLatLngs();for(var r=0,i=n.length;r<i;r++)t.extend(n[r]);return t},onAdd:function(t){e.Path.prototype.onAdd.call(this,t),this.editing&&this.editing.enabled()&&this.editing.addHooks()},onRemove:function(t){this.editing&&this.editing.enabled()&&this.editing.removeHooks(),e.Path.prototype.onRemove.call(this,t)},_initEvents:function(){e.Path.prototype._initEvents.call(this)},_getPathPartStr:function(t){var n=e.Path.VML;for(var r=0,i=t.length,s="",o;r<i;r++)o=t[r],n&&o._round(),s+=(r?"L":"M")+o.x+" "+o.y;return s},_clipPoints:function(){var t=this._originalPoints,n=t.length,r,i,s;if(this.options.noClip){this._parts=[t];return}this._parts=[];var o=this._parts,u=this._map._pathViewport,a=e.LineUtil;for(r=0,i=0;r<n-1;r++){s=a.clipSegment(t[r],t[r+1],u,r);if(!s)continue;o[i]=o[i]||[],o[i].push(s[0]);if(s[1]!==t[r+1]||r===n-2)o[i].push(s[1]),i++}},_simplifyPoints:function(){var t=this._parts,n=e.LineUtil;for(var r=0,i=t.length;r<i;r++)t[r]=n.simplify(t[r],this.options.smoothFactor)},_updatePath:function(){this._clipPoints(),this._simplifyPoints(),e.Path.prototype._updatePath.call(this)}}),e.PolyUtil={},e.PolyUtil.clipPolygon=function(t,n){var r=n.min,i=n.max,s,o=[1,4,2,8],u,a,f,l,c,h,p,d,v=e.LineUtil;for(u=0,h=t.length;u<h;u++)t[u]._code=v._getBitCode(t[u],n);for(f=0;f<4;f++){p=o[f],s=[];for(u=0,h=t.length,a=h-1;u<h;a=u++)l=t[u],c=t[a],l._code&p?c._code&p||(d=v._getEdgeIntersection(c,l,p,n),d._code=v._getBitCode(d,n),s.push(d)):(c._code&p&&(d=v._getEdgeIntersection(c,l,p,n),d._code=v._getBitCode(d,n),s.push(d)),s.push(l));t=s}return t},e.Polygon=e.Polyline.extend({options:{fill:!0},initialize:function(t,n){e.Polyline.prototype.initialize.call(this,t,n),t&&t[0]instanceof Array&&(this._latlngs=t[0],this._holes=t.slice(1))},projectLatlngs:function(){e.Polyline.prototype.projectLatlngs.call(this),this._holePoints=[];if(!this._holes)return;for(var t=0,n=this._holes.length,r;t<n;t++){this._holePoints[t]=[];for(var i=0,s=this._holes[t].length;i<s;i++)this._holePoints[t][i]=this._map.latLngToLayerPoint(this._holes[t][i])}},_clipPoints:function(){var t=this._originalPoints,n=[];this._parts=[t].concat(this._holePoints);if(this.options.noClip)return;for(var r=0,i=this._parts.length;r<i;r++){var s=e.PolyUtil.clipPolygon(this._parts[r],this._map._pathViewport);if(!s.length)continue;n.push(s)}this._parts=n},_getPathPartStr:function(t){var n=e.Polyline.prototype._getPathPartStr.call(this,t);return n+(e.Browser.svg?"z":"x")}}),function(){function t(t){return e.FeatureGroup.extend({initialize:function(e,t){this._layers={},this._options=t,this.setLatLngs(e)},setLatLngs:function(e){var n=0,r=e.length;this._iterateLayers(function(t){n<r?t.setLatLngs(e[n++]):this.removeLayer(t)},this);while(n<r)this.addLayer(new t(e[n++],this._options));return this}})}e.MultiPolyline=t(e.Polyline),e.MultiPolygon=t(e.Polygon)}(),e.Rectangle=e.Polygon.extend({initialize:function(t,n){e.Polygon.prototype.initialize.call(this,this._boundsToLatLngs(t),n)},setBounds:function(e){this.setLatLngs(this._boundsToLatLngs(e))},_boundsToLatLngs:function(e){return[e.getSouthWest(),e.getNorthWest(),e.getNorthEast(),e.getSouthEast(),e.getSouthWest()]}}),e.Circle=e.Path.extend({initialize:function(t,n,r){e.Path.prototype.initialize.call(this,r),this._latlng=t,this._mRadius=n},options:{fill:!0},setLatLng:function(e){return this._latlng=e,this.redraw()},setRadius:function(e){return this._mRadius=e,this.redraw()},projectLatlngs:function(){var t=this._getLngRadius(),n=new e.LatLng(this._latlng.lat,this._latlng.lng-t,!0),r=this._map.latLngToLayerPoint(n);this._point=this._map.latLngToLayerPoint(this._latlng),this._radius=Math.max(Math.round(this._point.x-r.x),1)},getBounds:function(){var t=this._map,n=this._radius*Math.cos(Math.PI/4),r=t.project(this._latlng),i=new e.Point(r.x-n,r.y+n),s=new e.Point(r.x+n,r.y-n),o=t.getZoom(),u=t.unproject(i,o,!0),a=t.unproject(s,o,!0);return new e.LatLngBounds(u,a)},getLatLng:function(){return this._latlng},getPathString:function(){var t=this._point,n=this._radius;return this._checkIfEmpty()?"":e.Browser.svg?"M"+t.x+","+(t.y-n)+"A"+n+","+n+",0,1,1,"+(t.x-.1)+","+(t.y-n)+" z":(t._round(),n=Math.round(n),"AL "+t.x+","+t.y+" "+n+","+n+" 0,"+23592600)},getRadius:function(){return this._mRadius},_getLngRadius:function(){var t=40075017,n=t*Math.cos(e.LatLng.DEG_TO_RAD*this._latlng.lat);return this._mRadius/n*360},_checkIfEmpty:function(){if(!this._map)return!1;var e=this._map._pathViewport,t=this._radius,n=this._point;return n.x-t>e.max.x||n.y-t>e.max.y||n.x+t<e.min.x||n.y+t<e.min.y}}),e.CircleMarker=e.Circle.extend({options:{radius:10,weight:2},initialize:function(t,n){e.Circle.prototype.initialize.call(this,t,null,n),this._radius=this.options.radius},projectLatlngs:function(){this._point=this._map.latLngToLayerPoint(this._latlng)},setRadius:function(e){return this._radius=e,this.redraw()}}),e.Polyline.include(e.Path.CANVAS?{_containsPoint:function(t,n){var r,i,s,o,u,a,f,l=this.options.weight/2;e.Browser.touch&&(l+=10);for(r=0,o=this._parts.length;r<o;r++){f=this._parts[r];for(i=0,u=f.length,s=u-1;i<u;s=i++){if(!n&&i===0)continue;a=e.LineUtil.pointToSegmentDistance(t,f[s],f[i]);if(a<=l)return!0}}return!1}}:{}),e.Polygon.include(e.Path.CANVAS?{_containsPoint:function(t){var n=!1,r,i,s,o,u,a,f,l;if(e.Polyline.prototype._containsPoint.call(this,t,!0))return!0;for(o=0,f=this._parts.length;o<f;o++){r=this._parts[o];for(u=0,l=r.length,a=l-1;u<l;a=u++)i=r[u],s=r[a],i.y>t.y!=s.y>t.y&&t.x<(s.x-i.x)*(t.y-i.y)/(s.y-i.y)+i.x&&(n=!n)}return n}}:{}),e.Circle.include(e.Path.CANVAS?{_drawPath:function(){var e=this._point;this._ctx.beginPath(),this._ctx.arc(e.x,e.y,this._radius,0,Math.PI*2,!1)},_containsPoint:function(e){var t=this._point,n=this.options.stroke?this.options.weight/2:0;return e.distanceTo(t)<=this._radius+n}}:{}),e.GeoJSON=e.FeatureGroup.extend({initialize:function(t,n){e.Util.setOptions(this,n),this._geojson=t,this._layers={},t&&this.addGeoJSON(t)},addGeoJSON:function(t){var n=t.features,r,i;if(n){for(r=0,i=n.length;r<i;r++)this.addGeoJSON(n[r]);return}var s=t.type==="Feature",o=s?t.geometry:t,u=e.GeoJSON.geometryToLayer(o,this.options.pointToLayer);this.fire("featureparse",{layer:u,properties:t.properties,geometryType:o.type,bbox:t.bbox,id:t.id}),this.addLayer(u)}}),e.Util.extend(e.GeoJSON,{geometryToLayer:function(t,n){var r=t.coordinates,i=[],s,o,u,a,f;switch(t.type){case"Point":return s=this.coordsToLatLng(r),n?n(s):new e.Marker(s);case"MultiPoint":for(u=0,a=r.length;u<a;u++)s=this.coordsToLatLng(r[u]),f=n?n(s):new e.Marker(s),i.push(f);return new e.FeatureGroup(i);case"LineString":return o=this.coordsToLatLngs(r),new e.Polyline(o);case"Polygon":return o=this.coordsToLatLngs(r,1),new e.Polygon(o);case"MultiLineString":return o=this.coordsToLatLngs(r,1),new e.MultiPolyline(o);case"MultiPolygon":return o=this.coordsToLatLngs(r,2),new e.MultiPolygon(o);case"GeometryCollection":for(u=0,a=t.geometries.length;u<a;u++)f=this.geometryToLayer(t.geometries[u],n),i.push(f);return new e.FeatureGroup(i);default:throw Error("Invalid GeoJSON object.")}},coordsToLatLng:function(t,n){var r=parseFloat(t[n?0:1]),i=parseFloat(t[n?1:0]);return new e.LatLng(r,i,!0)},coordsToLatLngs:function(e,t,n){var r,i=[],s,o;for(s=0,o=e.length;s<o;s++)r=t?this.coordsToLatLngs(e[s],t-1,n):this.coordsToLatLng(e[s],n),i.push(r);return i}}),e.DomEvent={addListener:function(t,n,r,i){var s=e.Util.stamp(r),o="_leaflet_"+n+s;if(t[o])return this;var u=function(n){return r.call(i||t,n||e.DomEvent._getEvent())};if(e.Browser.touch&&n==="dblclick"&&this.addDoubleTapListener)this.addDoubleTapListener(t,u,s);else if("addEventListener"in t)if(n==="mousewheel")t.addEventListener("DOMMouseScroll",u,!1),t.addEventListener(n,u,!1);else if(n==="mouseenter"||n==="mouseleave"){var a=u,f=n==="mouseenter"?"mouseover":"mouseout";u=function(n){if(!e.DomEvent._checkMouse(t,n))return;return a(n)},t.addEventListener(f,u,!1)}else t.addEventListener(n,u,!1);else"attachEvent"in t&&t.attachEvent("on"+n,u);return t[o]=u,this},removeListener:function(t,n,r){var i=e.Util.stamp(r),s="_leaflet_"+n+i,o=t[s];if(!o)return;return e.Browser.touch&&n==="dblclick"&&this.removeDoubleTapListener?this.removeDoubleTapListener(t,i):"removeEventListener"in t?n==="mousewheel"?(t.removeEventListener("DOMMouseScroll",o,!1),t.removeEventListener(n,o,!1)):n==="mouseenter"||n==="mouseleave"?t.removeEventListener(n==="mouseenter"?"mouseover":"mouseout",o,!1):t.removeEventListener(n,o,!1):"detachEvent"in t&&t.detachEvent("on"+n,o),t[s]=null,this},_checkMouse:function(e,t){var n=t.relatedTarget;if(!n)return!0;try{while(n&&n!==e)n=n.parentNode}catch(r){return!1}return n!==e},_getEvent:function(){var e=window.event;if(!e){var t=arguments.callee.caller;while(t){e=t.arguments[0];if(e&&window.Event===e.constructor)break;t=t.caller}}return e},stopPropagation:function(e){return e.stopPropagation?e.stopPropagation():e.cancelBubble=!0,this},disableClickPropagation:function(t){return e.DomEvent.addListener(t,e.Draggable.START,e.DomEvent.stopPropagation).addListener(t,"click",e.DomEvent.stopPropagation).addListener(t,"dblclick",e.DomEvent.stopPropagation)},preventDefault:function(e){return e.preventDefault?e.preventDefault():e.returnValue=!1,this},stop:function(t){return e.DomEvent.preventDefault(t).stopPropagation(t)},getMousePosition:function(t,n){var r=t.pageX?t.pageX:t.clientX+document.body.scrollLeft+document.documentElement.scrollLeft,i=t.pageY?t.pageY:t.clientY+document.body.scrollTop+document.documentElement.scrollTop,s=new e.Point(r,i);return n?s.subtract(e.DomUtil.getViewportOffset(n)):s},getWheelDelta:function(e){var t=0;return e.wheelDelta&&(t=e.wheelDelta/120),e.detail&&(t=-e.detail/3),t}},e.Draggable=e.Class.extend({includes:e.Mixin.Events,statics:{START:e.Browser.touch?"touchstart":"mousedown",END:e.Browser.touch?"touchend":"mouseup",MOVE:e.Browser.touch?"touchmove":"mousemove",TAP_TOLERANCE:15},initialize:function(e,t){this._element=e,this._dragStartTarget=t||e},enable:function(){if(this._enabled)return;e.DomEvent.addListener(this._dragStartTarget,e.Draggable.START,this._onDown,this),this._enabled=!0},disable:function(){if(!this._enabled)return;e.DomEvent.removeListener(this._dragStartTarget,e.Draggable.START,this._onDown),this._enabled=!1,this._moved=!1},_onDown:function(t){if(!e.Browser.touch&&t.shiftKey||t.which!==1&&t.button!==1&&!t.touches)return;this._simulateClick=!0;if(t.touches&&t.touches.length>1){this._simulateClick=!1;return}var n=t.touches&&t.touches.length===1?t.touches[0]:t,r=n.target;e.DomEvent.preventDefault(t),e.Browser.touch&&r.tagName.toLowerCase()==="a"&&(r.className+=" leaflet-active"),this._moved=!1;if(this._moving)return;e.Browser.touch||(e.DomUtil.disableTextSelection(),this._setMovingCursor()),this._startPos=this._newPos=e.DomUtil.getPosition(this._element),this._startPoint=new e.Point(n.clientX,n.clientY),e.DomEvent.addListener(document,e.Draggable.MOVE,this._onMove,this),e.DomEvent.addListener(document,e.Draggable.END,this._onUp,this)},_onMove:function(t){if(t.touches&&t.touches.length>1)return;e.DomEvent.preventDefault(t);var n=t.touches&&t.touches.length===1?t.touches[0]:t;this._moved||(this.fire("dragstart"),this._moved=!0),this._moving=!0;var r=new e.Point(n.clientX,n.clientY);this._newPos=this._startPos.add(r).subtract(this._startPoint),e.Util.cancelAnimFrame(this._animRequest),this._animRequest=e.Util.requestAnimFrame(this._updatePosition,this,!0,this._dragStartTarget)},_updatePosition:function(){this.fire("predrag"),e.DomUtil.setPosition(this._element,this._newPos),this.fire("drag")},_onUp:function(t){if(this._simulateClick&&t.changedTouches){var n=t.changedTouches[0],r=n.target,i=this._newPos&&this._newPos.distanceTo(this._startPos)||0;r.tagName.toLowerCase()==="a"&&(r.className=r.className.replace(" leaflet-active","")),i<e.Draggable.TAP_TOLERANCE&&this._simulateEvent("click",n)}e.Browser.touch||(e.DomUtil.enableTextSelection(),this._restoreCursor()),e.DomEvent.removeListener(document,e.Draggable.MOVE,this._onMove),e.DomEvent.removeListener(document,e.Draggable.END,this._onUp),this._moved&&this.fire("dragend"),this._moving=!1},_setMovingCursor:function(){document.body.className+=" leaflet-dragging"},_restoreCursor:function(){document.body.className=document.body.className.replace(/ leaflet-dragging/g,"")},_simulateEvent:function(e,t){var n=document.createEvent("MouseEvents");n.initMouseEvent(e,!0,!0,window,1,t.screenX,t.screenY,t.clientX,t.clientY,!1,!1,!1,!1,0,null),t.target.dispatchEvent(n)}}),e.Handler=e.Class.extend({initialize:function(e){this._map=e},enable:function(){if(this._enabled)return;this._enabled=!0,this.addHooks()},disable:function(){if(!this._enabled)return;this._enabled=!1,this.removeHooks()},enabled:function(){return!!this._enabled}}),e.Map.mergeOptions({dragging:!0,inertia:!e.Browser.android,inertiaDeceleration:e.Browser.touch?3e3:2e3,inertiaMaxSpeed:e.Browser.touch?1500:1e3,inertiaThreshold:e.Browser.touch?32:16,worldCopyJump:!0,continuousWorld:!1}),e.Map.Drag=e.Handler.extend({addHooks:function(){if(!this._draggable){this._draggable=new e.Draggable(this._map._mapPane,this._map._container),this._draggable.on("dragstart",this._onDragStart,this).on("drag",this._onDrag,this).on("dragend",this._onDragEnd,this);var t=this._map.options;t.worldCopyJump&&!t.continuousWorld&&(this._draggable.on("predrag",this._onPreDrag,this),this._map.on("viewreset",this._onViewReset,this))}this._draggable.enable()},removeHooks:function(){this._draggable.disable()},moved:function(){return this._draggable&&this._draggable._moved},_onDragStart:function(){var e=this._map;e.fire("movestart").fire("dragstart"),e._panTransition&&e._panTransition._onTransitionEnd(!0),e.options.inertia&&(this._positions=[],this._times=[])},_onDrag:function(){if(this._map.options.inertia){var e=this._lastTime=+(new Date),t=this._lastPos=this._draggable._newPos;this._positions.push(t),this._times.push(e),e-this._times[0]>200&&(this._positions.shift(),this._times.shift())}this._map.fire("move").fire("drag")},_onViewReset:function(){var t=this._map.getSize().divideBy(2),n=this._map.latLngToLayerPoint(new e.LatLng(0,0));this._initialWorldOffset=n.subtract(t)},_onPreDrag:function(){var e=this._map,t=e.options.crs.scale(e.getZoom()),n=Math.round(t/2),r=this._initialWorldOffset.x,i=this._draggable._newPos.x,s=(i-n+r)%t+n-r,o=(i+n+r)%t-n-r,u=Math.abs(s+r)<Math.abs(o+r)?s:o;this._draggable._newPos.x=u},_onDragEnd:function(){var t=this._map,n=t.options,r=+(new Date)-this._lastTime,i=!n.inertia||r>n.inertiaThreshold||typeof this._positions[0]=="undefined";if(i)t.fire("moveend");else{var s=this._lastPos.subtract(this._positions[0]),o=(this._lastTime+r-this._times[0])/1e3,u=s.multiplyBy(.58/o),a=u.distanceTo(new e.Point(0,0)),f=Math.min(n.inertiaMaxSpeed,a),l=u.multiplyBy(f/a),c=f/n.inertiaDeceleration,h=l.multiplyBy(-c/2).round(),p={duration:c,easing:"ease-out"};e.Util.requestAnimFrame(e.Util.bind(function(){this._map.panBy(h,p)},this))}t.fire("dragend"),n.maxBounds&&e.Util.requestAnimFrame(this._panInsideMaxBounds,t,!0,t._container)},_panInsideMaxBounds:function(){this.panInsideBounds(this.options.maxBounds)}}),e.Map.addInitHook("addHandler","dragging",e.Map.Drag),e.Map.mergeOptions({doubleClickZoom:!0}),e.Map.DoubleClickZoom=e.Handler.extend({addHooks:function(){this._map.on("dblclick",this._onDoubleClick)},removeHooks:function(){this._map.off("dblclick",this._onDoubleClick)},_onDoubleClick:function(e){this.setView(e.latlng,this._zoom+1)}}),e.Map.addInitHook("addHandler","doubleClickZoom",e.Map.DoubleClickZoom),e.Map.mergeOptions({scrollWheelZoom:!e.Browser.touch}),e.Map.ScrollWheelZoom=e.Handler.extend({addHooks:function(){e.DomEvent.addListener(this._map._container,"mousewheel",this._onWheelScroll,this),this._delta=0},removeHooks:function(){e.DomEvent.removeListener(this._map._container,"mousewheel",this._onWheelScroll)},_onWheelScroll:function(t){var n=e.DomEvent.getWheelDelta(t);this._delta+=n,this._lastMousePos=this._map.mouseEventToContainerPoint(t),clearTimeout(this._timer),this._timer=setTimeout(e.Util.bind(this._performZoom,this),50),e.DomEvent.preventDefault(t)},_performZoom:function(){var e=this._map,t=Math.round(this._delta),n=e.getZoom();t=Math.max(Math.min(t,4),-4),t=e._limitZoom(n+t)-n,this._delta=0;if(!t)return;var r=this._getCenterForScrollWheelZoom(this._lastMousePos,t),i=n+t;e.setView(r,i)},_getCenterForScrollWheelZoom:function(e,t){var n=this._map,r=n.getPixelBounds().getCenter(),i=n.getSize().divideBy(2),s=e.subtract(i).multiplyBy(1-Math.pow(2,-t)),o=r.add(s);return n.unproject(o,n._zoom,!0)}}),e.Map.addInitHook("addHandler","scrollWheelZoom",e.Map.ScrollWheelZoom),e.Util.extend(e.DomEvent,{addDoubleTapListener:function(e,t,n){function l(e){if(e.touches.length!==1)return;var t=Date.now(),n=t-(r||t);o=e.touches[0],i=n>0&&n<=s,r=t}function c(e){i&&(o.type="dblclick",t(o),r=null)}var r,i=!1,s=250,o,u="_leaflet_",a="touchstart",f="touchend";e[u+a+n]=l,e[u+f+n]=c,e.addEventListener(a,l,!1),e.addEventListener(f,c,!1)},removeDoubleTapListener:function(e,t){var n="_leaflet_";e.removeEventListener(e,e[n+"touchstart"+t],!1),e.removeEventListener(e,e[n+"touchend"+t],!1)}}),e.Map.mergeOptions({touchZoom:e.Browser.touch&&!e.Browser.android}),e.Map.TouchZoom=e.Handler.extend({addHooks:function(){e.DomEvent.addListener(this._map._container,"touchstart",this._onTouchStart,this)},removeHooks:function(){e.DomEvent.removeListener(this._map._container,"touchstart",this._onTouchStart,this)},_onTouchStart:function(t){var n=this._map;if(!t.touches||t.touches.length!==2||n._animatingZoom||this._zooming)return;var r=n.mouseEventToLayerPoint(t.touches[0]),i=n.mouseEventToLayerPoint(t.touches[1]),s=n.containerPointToLayerPoint(n.getSize().divideBy(2));this._startCenter=r.add(i).divideBy(2,!0),this._startDist=r.distanceTo(i),this._moved=!1,this._zooming=!0,this._centerOffset=s.subtract(this._startCenter),e.DomEvent.addListener(document,"touchmove",this._onTouchMove,this).addListener(document,"touchend",this._onTouchEnd,this),e.DomEvent.preventDefault(t)},_onTouchMove:function(t){if(!t.touches||t.touches.length!==2)return;var n=this._map,r=n.mouseEventToLayerPoint(t.touches[0]),i=n.mouseEventToLayerPoint(t.touches[1]);this._scale=r.distanceTo(i)/this._startDist,this._delta=r.add(i).divideBy(2,!0).subtract(this._startCenter);if(this._scale===1)return;this._moved||(n._mapPane.className+=" leaflet-zoom-anim",n.fire("zoomstart").fire("movestart")._prepareTileBg(),this._moved=!0),n._tileBg.style.webkitTransform=e.DomUtil.getTranslateString(this._delta)+" "+e.DomUtil.getScaleString(this._scale,this._startCenter),e.DomEvent.preventDefault(t)},_onTouchEnd:function(t){if(!this._moved||!this._zooming)return;this._zooming=!1,e.DomEvent.removeListener(document,"touchmove",this._onTouchMove).removeListener(document,"touchend",this._onTouchEnd);var n=this._centerOffset.subtract(this._delta).divideBy(this._scale),r=this._map.getPixelOrigin().add(this._startCenter).add(n),i=this._map.unproject(r),s=this._map.getZoom(),o=Math.log(this._scale)/Math.LN2,u=o>0?Math.ceil(o):Math.floor(o),a=this._map._limitZoom(s+u),f=Math.pow(2,a-s);this._map._runAnimation(i,a,f/this._scale,this._startCenter.add(n))}}),e.Map.addInitHook("addHandler","touchZoom",e.Map.TouchZoom),e.Map.mergeOptions({boxZoom:!0}),e.Map.BoxZoom=e.Handler.extend({initialize:function(e){this._map=e,this._container=e._container,this._pane=e._panes.overlayPane},addHooks:function(){e.DomEvent.addListener(this._container,"mousedown",this._onMouseDown,this)},removeHooks:function(){e.DomEvent.removeListener(this._container,"mousedown",this._onMouseDown)},_onMouseDown:function(t){if(!t.shiftKey||t.which!==1&&t.button!==1)return!1;e.DomUtil.disableTextSelection(),this._startLayerPoint=this._map.mouseEventToLayerPoint(t),this._box=e.DomUtil.create("div","leaflet-zoom-box",this._pane),e.DomUtil.setPosition(this._box,this._startLayerPoint),this._container.style.cursor="crosshair",e.DomEvent.addListener(document,"mousemove",this._onMouseMove,this).addListener(document,"mouseup",this._onMouseUp,this).preventDefault(t),this._map.fire("boxzoomstart")},_onMouseMove:function(t){var n=this._startLayerPoint,r=this._box,i=this._map.mouseEventToLayerPoint(t),s=i.subtract(n),o=new e.Point(Math.min(i.x,n.x),Math.min(i.y,n.y));e.DomUtil.setPosition(r,o),r.style.width=Math.abs(s.x)-4+"px",r.style.height=Math.abs(s.y)-4+"px"},_onMouseUp:function(t){this._pane.removeChild(this._box),this._container.style.cursor="",e.DomUtil.enableTextSelection(),e.DomEvent.removeListener(document,"mousemove",this._onMouseMove).removeListener(document,"mouseup",this._onMouseUp);var n=this._map,r=n.mouseEventToLayerPoint(t),i=new e.LatLngBounds(n.layerPointToLatLng(this._startLayerPoint),n.layerPointToLatLng(r));n.fitBounds(i),n.fire("boxzoomend",{boxZoomBounds:i})}}),e.Map.addInitHook("addHandler","boxZoom",e.Map.BoxZoom),e.Handler.MarkerDrag=e.Handler.extend({initialize:function(e){this._marker=e},addHooks:function(){var t=this._marker._icon;this._draggable||(this._draggable=(new e.Draggable(t,t)).on("dragstart",this._onDragStart,this).on("drag",this._onDrag,this).on("dragend",this._onDragEnd,this)),this._draggable.enable()},removeHooks:function(){this._draggable.disable()},moved:function(){return this._draggable&&this._draggable._moved},_onDragStart:function(e){this._marker.closePopup().fire("movestart").fire("dragstart")},_onDrag:function(t){var n=e.DomUtil.getPosition(this._marker._icon);this._marker._shadow&&e.DomUtil.setPosition(this._marker._shadow,n),this._marker._latlng=this._marker._map.layerPointToLatLng(n),this._marker.fire("move").fire("drag")},_onDragEnd:function(){this._marker.fire("moveend").fire("dragend")}}),e.Handler.PolyEdit=e.Handler.extend({options:{icon:new e.DivIcon({iconSize:new e.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon"})},initialize:function(t,n){this._poly=t,e.Util.setOptions(this,n)},addHooks:function(){this._poly._map&&(this._markerGroup||this._initMarkers(),this._poly._map.addLayer(this._markerGroup))},removeHooks:function(){this._poly._map&&(this._poly._map.removeLayer(this._markerGroup),delete this._markerGroup,delete this._markers)},updateMarkers:function(){this._markerGroup.clearLayers(),this._initMarkers()},_initMarkers:function(){this._markerGroup=new e.LayerGroup,this._markers=[];var t=this._poly._latlngs,n,r,i,s;for(n=0,i=t.length;n<i;n++)s=this._createMarker(t[n],n),s.on("click",this._onMarkerClick,this),this._markers.push(s);var o,u;for(n=0,r=i-1;n<i;r=n++){if(n===0&&!(e.Polygon&&this._poly instanceof e.Polygon))continue;o=this._markers[r],u=this._markers[n],this._createMiddleMarker(o,u),this._updatePrevNext(o,u)}},_createMarker:function(t,n){var r=new e.Marker(t,{draggable:!0,icon:this.options.icon});return r._origLatLng=t,r._index=n,r.on("drag",this._onMarkerDrag,this),r.on("dragend",this._fireEdit,this),this._markerGroup.addLayer(r),r},_fireEdit:function(){this._poly.fire("edit")},_onMarkerDrag:function(t){var n=t.target;e.Util.extend(n._origLatLng,n._latlng),n._middleLeft&&n._middleLeft.setLatLng(this._getMiddleLatLng(n._prev,n)),n._middleRight&&n._middleRight.setLatLng(this._getMiddleLatLng(n,n._next)),this._poly.redraw()},_onMarkerClick:function(e){if(this._poly._latlngs.length<3)return;var t=e.target,n=t._index;t._prev&&t._next&&(this._createMiddleMarker(t._prev,t._next),this._updatePrevNext(t._prev,t._next)),this._markerGroup.removeLayer(t),t._middleLeft&&this._markerGroup.removeLayer(t._middleLeft),t._middleRight&&this._markerGroup.removeLayer(t._middleRight),this._markers.splice(n,1),this._poly.spliceLatLngs(n,1),this._updateIndexes(n,-1),this._poly.fire("edit")},_updateIndexes:function(e,t){this._markerGroup._iterateLayers(function(n){n._index>e&&(n._index+=t)})},_createMiddleMarker:function(e,t){var n=this._getMiddleLatLng(e,t),r=this._createMarker(n),i,s,o;r.setOpacity(.6),e._middleRight=t._middleLeft=r,s=function(){var s=t._index;r._index=s,r.off("click",i).on("click",this._onMarkerClick,this),this._poly.spliceLatLngs(s,0,n),this._markers.splice(s,0,r),r.setOpacity(1),this._updateIndexes(s,1),t._index++,this._updatePrevNext(e,r),this._updatePrevNext(r,t)},o=function(){r.off("dragstart",s,this),r.off("dragend",o,this),this._createMiddleMarker(e,r),this._createMiddleMarker(r,t)},i=function(){s.call(this),o.call(this),this._poly.fire("edit")},r.on("click",i,this).on("dragstart",s,this).on("dragend",o,this),this._markerGroup.addLayer(r)},_updatePrevNext:function(e,t){e._next=t,t._prev=e},_getMiddleLatLng:function(e,t){var n=this._poly._map,r=n.latLngToLayerPoint(e.getLatLng()),i=n.latLngToLayerPoint(t.getLatLng());return n.layerPointToLatLng(r._add(i).divideBy(2))}}),e.Control=e.Class.extend({options:{position:"topright"},initialize:function(t){e.Util.setOptions(this,t)},getPosition:function(){return this.options.position},setPosition:function(e){var t=this._map;t&&t.removeControl(this),this.options.position=e,t&&t.addControl(this)},addTo:function(t){this._map=t;var n=this._container=this.onAdd(t),r=this.getPosition(),i=t._controlCorners[r];return e.DomUtil.addClass(n,"leaflet-control"),r.indexOf("bottom")!==-1?i.insertBefore(n,i.firstChild):i.appendChild(n),this},removeFrom:function(e){var t=this.getPosition(),n=e._controlCorners[t];return n.removeChild(this._container),this._map=null,this.onRemove&&this.onRemove(e),this}}),e.Map.include({addControl:function(e){return e.addTo(this),this},removeControl:function(e){return e.removeFrom(this),this},_initControlPos:function(){function i(i,s){var o=n+i+" "+n+s;t[i+s]=e.DomUtil.create("div",o,r)}var t=this._controlCorners={},n="leaflet-",r=this._controlContainer=e.DomUtil.create("div",n+"control-container",this._container);i("top","left"),i("top","right"),i("bottom","left"),i("bottom","right")}}),e.Control.Zoom=e.Control.extend({options:{position:"topleft"},onAdd:function(t){var n="leaflet-control-zoom",r=e.DomUtil.create("div",n);return this._createButton("Zoom in",n+"-in",r,t.zoomIn,t),this._createButton("Zoom out",n+"-out",r,t.zoomOut,t),r},_createButton:function(t,n,r,i,s){var o=e.DomUtil.create("a",n,r);return o.href="#",o.title=t,e.DomEvent.addListener(o,"click",e.DomEvent.stopPropagation).addListener(o,"click",e.DomEvent.preventDefault).addListener(o,"click",i,s),o}}),e.Map.mergeOptions({zoomControl:!0}),e.Map.addInitHook(function(){this.options.zoomControl&&(this.zoomControl=new e.Control.Zoom,this.addControl(this.zoomControl))}),e.Control.Attribution=e.Control.extend({options:{position:"bottomright",prefix:'Powered by <a href="http://leaflet.cloudmade.com">Leaflet</a>'},initialize:function(t){e.Util.setOptions(this,t),this._attributions={}},onAdd:function(t){return this._container=e.DomUtil.create("div","leaflet-control-attribution"),e.DomEvent.disableClickPropagation(this._container),t.on("layeradd",this._onLayerAdd,this).on("layerremove",this._onLayerRemove,this),this._update(),this._container},onRemove:function(e){e.off("layeradd",this._onLayerAdd).off("layerremove",this._onLayerRemove)},setPrefix:function(e){this.options.prefix=e,this._update()},addAttribution:function(e){if(!e)return;this._attributions[e]||(this._attributions[e]=0),this._attributions[e]++,this._update()},removeAttribution:function(e){if(!e)return;this._attributions[e]--,this._update()},_update:function(){if(!this._map)return;var e=[];for(var t in this._attributions)this._attributions.hasOwnProperty(t)&&this._attributions[t]&&e.push(t);var n=[];this.options.prefix&&n.push(this.options.prefix),e.length&&n.push(e.join(", ")),this._container.innerHTML=n.join(" &mdash; ")},_onLayerAdd:function(e){e.layer.getAttribution&&this.addAttribution(e.layer.getAttribution())},_onLayerRemove:function(e){e.layer.getAttribution&&this.removeAttribution(e.layer.getAttribution())}}),e.Map.mergeOptions({attributionControl:!0}),e.Map.addInitHook(function(){this.options.attributionControl&&(this.attributionControl=(new e.Control.Attribution).addTo(this))}),e.Control.Scale=e.Control.extend({options:{position:"bottomleft",maxWidth:100,metric:!0,imperial:!0,updateWhenIdle:!1},onAdd:function(t){this._map=t;var n="leaflet-control-scale",r=e.DomUtil.create("div",n),i=this.options;return i.metric&&(this._mScale=e.DomUtil.create("div",n+"-line",r)),i.imperial&&(this._iScale=e.DomUtil.create("div",n+"-line",r)),t.on(i.updateWhenIdle?"moveend":"move",this._update,this),this._update(),r},onRemove:function(e){e.off(this.options.updateWhenIdle?"moveend":"move",this._update,this)},_update:function(){var t=this._map.getBounds(),n=t.getCenter().lat,r=new e.LatLng(n,t.getSouthWest().lng),i=new e.LatLng(n,t.getNorthEast().lng),s=this._map.getSize(),o=this.options,u=r.distanceTo(i)*(o.maxWidth/s.x);o.metric&&this._updateMetric(u),o.imperial&&this._updateImperial(u)},_updateMetric:function(e){var t=this._getRoundNum(e);this._mScale.style.width=this._getScaleWidth(t/e)+"px",this._mScale.innerHTML=t<1e3?t+" m":t/1e3+" km"},_updateImperial:function(e){var t=e*3.2808399,n=this._iScale,r,i,s;t>5280?(r=t/5280,i=this._getRoundNum(r),n.style.width=this._getScaleWidth(i/r)+"px",n.innerHTML=i+" mi"):(s=this._getRoundNum(t),n.style.width=this._getScaleWidth(s/t)+"px",n.innerHTML=s+" ft")},_getScaleWidth:function(e){return Math.round(this.options.maxWidth*e)-10},_getRoundNum:function(e){var t=Math.pow(10,(Math.floor(e)+"").length-1),n=e/t;return n=n>=10?10:n>=5?5:n>=2?2:1,t*n}}),e.Control.Layers=e.Control.extend({options:{collapsed:!0,position:"topright"},initialize:function(t,n,r){e.Util.setOptions(this,r),this._layers={};for(var i in t)t.hasOwnProperty(i)&&this._addLayer(t[i],i);for(i in n)n.hasOwnProperty(i)&&this._addLayer(n[i],i,!0)},onAdd:function(e){return this._initLayout(),this._update(),this._container},addBaseLayer:function(e,t){return this._addLayer(e,t),this._update(),this},addOverlay:function(e,t){return this._addLayer(e,t,!0),this._update(),this},removeLayer:function(t){var n=e.Util.stamp(t);return delete this._layers[n],this._update(),this},_initLayout:function(){var t="leaflet-control-layers",n=this._container=e.DomUtil.create("div",t);e.Browser.touch?e.DomEvent.addListener(n,"click",e.DomEvent.stopPropagation):e.DomEvent.disableClickPropagation(n);var r=this._form=e.DomUtil.create("form",t+"-list");if(this.options.collapsed){e.DomEvent.addListener(n,"mouseover",this._expand,this).addListener(n,"mouseout",this._collapse,this);var i=this._layersLink=e.DomUtil.create("a",t+"-toggle",n);i.href="#",i.title="Layers",e.DomEvent.addListener(i,e.Browser.touch?"click":"focus",this._expand,this),this._map.on("movestart",this._collapse,this)}else this._expand();this._baseLayersList=e.DomUtil.create("div",t+"-base",r),this._separator=e.DomUtil.create("div",t+"-separator",r),this._overlaysList=e.DomUtil.create("div",t+"-overlays",r),n.appendChild(r)},_addLayer:function(t,n,r){var i=e.Util.stamp(t);this._layers[i]={layer:t,name:n,overlay:r}},_update:function(){if(!this._container)return;this._baseLayersList.innerHTML="",this._overlaysList.innerHTML="";var e=!1,t=!1;for(var n in this._layers)if(this._layers.hasOwnProperty(n)){var r=this._layers[n];this._addItem(r),t=t||r.overlay,e=e||!r.overlay}this._separator.style.display=t&&e?"":"none"},_addItem:function(t,n){var r=document.createElement("label"),i=document.createElement("input");t.overlay||(i.name="leaflet-base-layers"),i.type=t.overlay?"checkbox":"radio",i.layerId=e.Util.stamp(t.layer),i.defaultChecked=this._map.hasLayer(t.layer),e.DomEvent.addListener(i,"click",this._onInputClick,this);var s=document.createTextNode(" "+t.name);r.appendChild(i),r.appendChild(s);var o=t.overlay?this._overlaysList:this._baseLayersList;o.appendChild(r)},_onInputClick:function(){var e,t,n,r=this._form.getElementsByTagName("input"),i=r.length;for(e=0;e<i;e++)t=r[e],n=this._layers[t.layerId],t.checked?this._map.addLayer(n.layer,!n.overlay):this._map.removeLayer(n.layer)},_expand:function(){e.DomUtil.addClass(this._container,"leaflet-control-layers-expanded")},_collapse:function(){this._container.className=this._container.className.replace(" leaflet-control-layers-expanded","")}}),e.Transition=e.Class.extend({includes:e.Mixin.Events,statics:{CUSTOM_PROPS_SETTERS:{position:e.DomUtil.setPosition},implemented:function(){return e.Transition.NATIVE||e.Transition.TIMER}},options:{easing:"ease",duration:.5},_setProperty:function(t,n){var r=e.Transition.CUSTOM_PROPS_SETTERS;t in r?r[t](this._el,n):this._el.style[t]=n}}),e.Transition=e.Transition.extend({statics:function(){var t=e.DomUtil.TRANSITION,n=t==="webkitTransition"||t==="OTransition"?t+"End":"transitionend";return{NATIVE:!!t,TRANSITION:t,PROPERTY:t+"Property",DURATION:t+"Duration",EASING:t+"TimingFunction",END:n,CUSTOM_PROPS_PROPERTIES:{position:e.Browser.webkit?e.DomUtil.TRANSFORM:"top, left"}}}(),options:{fakeStepInterval:100},initialize:function(t,n){this._el=t,e.Util.setOptions(this,n),e.DomEvent.addListener(t,e.Transition.END,this._onTransitionEnd,this),this._onFakeStep=e.Util.bind(this._onFakeStep,this)},run:function(t){var n,r=[],i=e.Transition.CUSTOM_PROPS_PROPERTIES;for(n in t)t.hasOwnProperty(n)&&(n=i[n]?i[n]:n,n=this._dasherize(n),r.push(n));this._el.style[e.Transition.DURATION]=this.options.duration+"s",this._el.style[e.Transition.EASING]=this.options.easing,this._el.style[e.Transition.PROPERTY]=r.join(", ");for(n in t)t.hasOwnProperty(n)&&this._setProperty(n,t[n]);this._inProgress=!0,this.fire("start"),e.Transition.NATIVE?(clearInterval(this._timer),this._timer=setInterval(this._onFakeStep,this.options.fakeStepInterval)):this._onTransitionEnd()},_dasherize:function(){function t(e){return"-"+e.toLowerCase()}var e=/([A-Z])/g;return function(n){return n.replace(e,t)}}(),_onFakeStep:function(){this.fire("step")},_onTransitionEnd:function(t){this._inProgress&&(this._inProgress=!1,clearInterval(this._timer),this._el.style[e.Transition.PROPERTY]="none",this.fire("step"),t&&t.type&&this.fire("end"))}}),e.Transition=e.Transition.NATIVE?e.Transition:e.Transition.extend({statics:{getTime:Date.now||function(){return+(new Date)},TIMER:!0,EASINGS:{ease:[.25,.1,.25,1],linear:[0,0,1,1],"ease-in":[.42,0,1,1],"ease-out":[0,0,.58,1],"ease-in-out":[.42,0,.58,1]},CUSTOM_PROPS_GETTERS:{position:e.DomUtil.getPosition},UNIT_RE:/^[\d\.]+(\D*)$/},options:{fps:50},initialize:function(t,n){this._el=t,e.Util.extend(this.options,n);var r=e.Transition.EASINGS[this.options.easing]||e.Transition.EASINGS.ease;this._p1=new e.Point(0,0),this._p2=new e.Point(r[0],r[1]),this._p3=new e.Point(r[2],r[3]),this._p4=new e.Point(1,1),this._step=e.Util.bind(this._step,this),this._interval=Math.round(1e3/this.options.fps)},run:function(t){this._props={};var n=e.Transition.CUSTOM_PROPS_GETTERS,r=e.Transition.UNIT_RE;this.fire("start");for(var i in t)if(t.hasOwnProperty(i)){var s={};if(i in n)s.from=n[i](this._el);else{var o=this._el.style[i].match(r);s.from=parseFloat(o[0]),s.unit=o[1]}s.to=t[i],this._props[i]=s}clearInterval(this._timer),this._timer=setInterval(this._step,this._interval),this._startTime=e.Transition.getTime()},_step:function(){var t=e.Transition.getTime(),n=t-this._startTime,r=this.options.duration*1e3;n<r?this._runFrame(this._cubicBezier(n/r)):(this._runFrame(1),this._complete())},_runFrame:function(t){var n=e.Transition.CUSTOM_PROPS_SETTERS,r,i,s;for(r in this._props)this._props.hasOwnProperty(r)&&(i=this._props[r],r in n?(s=i.to.subtract(i.from).multiplyBy(t).add(i.from),n[r](this._el,s)):this._el.style[r]=(i.to-i.from)*t+i.from+i.unit);this.fire("step")},_complete:function(){clearInterval(this._timer),this.fire("end")},_cubicBezier:function(e){var t=Math.pow(1-e,3),n=3*Math.pow(1-e,2)*e,r=3*(1-e)*Math.pow(e,2),i=Math.pow(e,3),s=this._p1.multiplyBy(t),o=this._p2.multiplyBy(n),u=this._p3.multiplyBy(r),a=this._p4.multiplyBy(i);return s.add(o).add(u).add(a).y}}),e.Map.include(!e.Transition||!e.Transition.implemented()?{}:{setView:function(t,n,r){n=this._limitZoom(n);var i=this._zoom!==n;if(this._loaded&&!r&&this._layers){var s=this._getNewTopLeftPoint(t).subtract(this._getTopLeftPoint());t=new e.LatLng(t.lat,t.lng);var o=i?this._zoomToIfCenterInView&&this._zoomToIfCenterInView(t,n,s):this._panByIfClose(s);if(o)return this}return this._resetView(t,n),this},panBy:function(t,n){return!t.x&&!t.y?this:(this._panTransition||(this._panTransition=new e.Transition(this._mapPane),this._panTransition.on("step",this._onPanTransitionStep,this),this._panTransition.on("end",this._onPanTransitionEnd,this)),e.Util.setOptions(this._panTransition,e.Util.extend({duration:.25},n)),this.fire("movestart"),this._mapPane.className+=" leaflet-pan-anim",this._panTransition.run({position:e.DomUtil.getPosition(this._mapPane).subtract(t)}),this)},_onPanTransitionStep:function(){this.fire("move")},_onPanTransitionEnd:function(){this._mapPane.className=this._mapPane.className.replace(/ leaflet-pan-anim/g,""),this.fire("moveend")},_panByIfClose:function(e){return this._offsetIsWithinView(e)?(this.panBy(e),!0):!1},_offsetIsWithinView:function(e,t){var n=t||1,r=this.getSize();return Math.abs(e.x)<=r.x*n&&Math.abs(e.y)<=r.y*n}}),e.Map.mergeOptions({zoomAnimation:e.DomUtil.TRANSITION&&!e.Browser.android&&!e.Browser.mobileOpera}),e.Map.include(e.DomUtil.TRANSITION?{_zoomToIfCenterInView:function(e,t,n){if(this._animatingZoom)return!0;if(!this.options.zoomAnimation)return!1;var r=Math.pow(2,t-this._zoom),i=n.divideBy(1-1/r);if(!this._offsetIsWithinView(i,1))return!1;this._mapPane.className+=" leaflet-zoom-anim",this.fire("movestart").fire("zoomstart"),this._prepareTileBg();var s=this.containerPointToLayerPoint(this.getSize().divideBy(2)),o=s.add(i);return this._runAnimation(e,t,r,o),!0},_runAnimation:function(t,n,r,i){this._animatingZoom=!0,this._animateToCenter=t,this._animateToZoom=n;var s=e.DomUtil.TRANSFORM,o=this._tileBg;clearTimeout(this._clearTileBgTimer);if(e.Browser.gecko||window.opera)o.style[s]+=" translate(0,0)";var u;e.Browser.android?(o.style[s+"Origin"]=i.x+"px "+i.y+"px",u="scale("+r+")"):u=e.DomUtil.getScaleString(r,i),e.Util.falseFn(o.offsetWidth);var a={};a[s]=o.style[s]+" "+u,o.transition.run(a)},_prepareTileBg:function(){var t=this._tilePane,n=this._tileBg;n||(n=this._tileBg=this._createPane("leaflet-tile-pane",this._mapPane),n.style.zIndex=1),n.style[e.DomUtil.TRANSFORM]="",n.style.visibility="hidden",n.empty=!0,t.empty=!1,this._tilePane=this._panes.tilePane=n;var r=this._tileBg=t;r.transition||(r.transition=new e.Transition(r,{duration:.25,easing:"cubic-bezier(0.25,0.1,0.25,0.75)"}),r.transition.on("end",this._onZoomTransitionEnd,this)),this._stopLoadingImages(r)},_stopLoadingImages:function(t){var n=Array.prototype.slice.call(t.getElementsByTagName("img")),r,i,s;for(r=0,i=n.length;r<i;r++)s=n[r],s.complete||(s.onload=e.Util.falseFn,s.onerror=e.Util.falseFn,s.src=e.Util.emptyImageUrl,s.parentNode.removeChild(s))},_onZoomTransitionEnd:function(){this._restoreTileFront(),e.Util.falseFn(this._tileBg.offsetWidth),this._resetView(this._animateToCenter,this._animateToZoom,!0,!0),this._mapPane.className=this._mapPane.className.replace(" leaflet-zoom-anim",""),this._animatingZoom=!1},_restoreTileFront:function(){this._tilePane.innerHTML="",this._tilePane.style.visibility="",this._tilePane.style.zIndex=2,this._tileBg.style.zIndex=1},_clearTileBg:function(){!this._animatingZoom&&!this.touchZoom._zooming&&(this._tileBg.innerHTML="")}}:{}),e.Map.include({_defaultLocateOptions:{watch:!1,setView:!1,maxZoom:Infinity,timeout:1e4,maximumAge:0,enableHighAccuracy:!1},locate:function(t){t=this._locationOptions=e.Util.extend(this._defaultLocateOptions,t);if(!navigator.geolocation)return this.fire("locationerror",{code:0,message:"Geolocation not supported."});var n=e.Util.bind(this._handleGeolocationResponse,this),r=e.Util.bind(this._handleGeolocationError,this);return t.watch?this._locationWatchId=navigator.geolocation.watchPosition(n,r,t):navigator.geolocation.getCurrentPosition(n,r,t),this},stopLocate:function(){return navigator.geolocation&&navigator.geolocation.clearWatch(this._locationWatchId),this},_handleGeolocationError:function(e){var t=e.code,n=t===1?"permission denied":t===2?"position unavailable":"timeout";this._locationOptions.setView&&!this._loaded&&this.fitWorld(),this.fire("locationerror",{code:t,message:"Geolocation error: "+n+"."})},_handleGeolocationResponse:function(t){var n=180*t.coords.accuracy/4e7,r=n*2,i=t.coords.latitude,s=t.coords.longitude,o=new e.LatLng(i,s),u=new e.LatLng(i-n,s-r),a=new e.LatLng(i+n,s+r),f=new e.LatLngBounds(u,a),l=this._locationOptions;if(l.setView){var c=Math.min(this.getBoundsZoom(f),l.maxZoom);this.setView(o,c)}this.fire("locationfound",{latlng:o,bounds:f,accuracy:t.coords.accuracy})}})})();


  var setLocation = function(element) {
    if (element.location == 'auto') {
      element.xtag.map.locate({ setView: true, maxZoom: element.zoom });
    }
    else {
      var location = (element.location).replace(' ', '').split(',');
      element.xtag.map.setView(new L.LatLng(Number(location[0]), Number(location[1])), element.zoom);
    }
  };

  var setTileLayer = function() {
    if (this.xtag.tilelayer) this.xtag.map.removeLayer(this.xtag.tilelayer);
    this.xtag.tilelayer = new L.TileLayer(
      'http://{s}.tile.cloudmade.com/' + this.getAttribute('key') + '/' +
      (this.getAttribute('tile-set') || 997) +
      '/256/{z}/{x}/{y}.png',
      this.getAttribute('tile-options') || {}
    );
    this.xtag.map.addLayer(this.xtag.tilelayer);
    setLocation(this);
  };

  xtag.register('x-map', {
    lifecycle:{
      created: function() {
        var element = this;
        this.xtag.map = new L.Map(this);
        setTileLayer.call(this);
        ['load','viewreset','movestart','move','moveend','dragstart',
        'zoomend','layeradd','layerremove','locationfound','drag','dragend',
        'locationerror','popupopen','popupclose'].forEach(function(type) {
          element.xtag.map.on(type, function(event) {
            xtag.fireEvent(element, type);
          });
        });
      }
    },
    accessors:{
      tileSet: {
        get: function() {
          return this.getAttribute('tile-set') || 997;
        },
        set: function(value) {
          this.setAttribute('tile-set', value);
          setTileLayer.call(this);
        }
      },
      zoom: {
        get: function() {
          var zoom = this.getAttribute('zoom');
          return Number(zoom == null ? 13 : zoom);
        },
        set: function(value) {
          this.setAttribute('zoom', value);
          this.xtag.map.setZoom(this.zoom);
        }
      },
      location: {
        get: function() {
          var location = this.getAttribute('location') || '37.3880, -122.0829';
          return location;
        },
        set: function(value) {
          this.setAttribute('location', value);
          setLocation(this);
        }
      }
    }
  });

})();


(function(){

  var delayedEvents = [],
    fireMatches = function(element, mql, attr, skipFire){
      var state = (mql.matches) ? ['active', 'set', 'add'] : ['inactive', 'remove', 'remove'],
        eventType = 'mediaquery' + state[0],
        eventData = { 'query': mql };
      element[state[1] + 'Attribute']('matches', null);
      if (!skipFire) xtag.fireEvent(element, eventType, eventData);
      (attr || (element.getAttribute('for') || '').split(' ')).forEach(function(id){
        var node = document.getElementById(id);
        if (node) {
          xtag[state[2] + 'Class'](node, element.id);
          if (!skipFire) xtag.fireEvent(node, eventType, eventData, { bubbles: false });
        }
      });
    },
    attachQuery = function(element, query, attr, skipFire){
      if (!xtag.domready){
        skipFire = true;
        delayedEvents.push(element);
      }
      query = query || element.getAttribute('media');
      if (query){
        if (element.xtag.query) element.xtag.query.removeListener(element.xtag.listener);
        query = element.xtag.query = window.matchMedia(query);
        var listener = element.xtag.listener = function(mql){
          fireMatches(element, mql);
        };
        fireMatches(element, query, attr, skipFire);
        query.addListener(listener);
      }
    },
    delayedListener = function(){
      delayedEvents = delayedEvents.map(function(element){
        return attachQuery(element);
      });
      document.removeEventListener(delayedListener);
    };

  document.addEventListener('__DOMComponentsLoaded__', delayedListener);

  xtag.register('x-mediaquery', {
    lifecycle:{
      created: function(){
        attachQuery(this);
      }
    },
    accessors:{
      'for': {
        get: function(){
          return this.getAttribute('for');
        },
        set: function(value){
          var next = (value || '').split(' ');
          (this.getAttribute('for') || '').split(' ').map(function(id){
            var index = next.indexOf(id);
            if (index == -1){
              var element = document.getElementById(id);
              if (element){
                xtag.removeClass(element, this.id);
                xtag.fireEvent(element, 'mediaqueryremoved');
              }
            }
            else next.splice(index, 1);
          }, this);
          attachQuery(this, null, next);
        }
      },
      'media': {
        attribute: {},
        get: function(){
          return this.getAttribute('media');
        },
        set: function(value){
          attachQuery(this, query);
        }
      },
      'id': {
        attribute: {},
        get: function(){
          return this.getAttribute('id');
        },
        set: function(value){
          var current = this.getAttribute('id');
          xtag.query(document, '.' + current).forEach(function(node){
            xtag.removeClass(node, current);
            xtag.addClass(node, id);
          });
        }
      }
    }
  });

})();
(function(){

var head = document.querySelector('head');
var anchor = document.createElement('a');
anchor.href = '';
xtag.callbacks = {};

  function request(element, options){
    clearRequest(element);
    var last = element.xtag.request || {};
    element.xtag.request = options;
    var request = element.xtag.request,
      callbackKey = (element.getAttribute('data-callback-key') ||
        'callback') + '=xtag.callbacks.';
    if (xtag.fireEvent(element, 'beforerequest') === false) return false;
    if (last.url && !options.update &&
      last.url.replace(new RegExp('\&?\(' + callbackKey + 'x[0-9]+)'), '') ==
        element.xtag.request.url){
      element.xtag.request = last;
      return false;
    }
    element.setAttribute('src', element.xtag.request.url);
    anchor.href = options.url;
    if (~anchor.href.indexOf(window.location.hostname)) {
      request = xtag.merge(new XMLHttpRequest(), request);
      request.onreadystatechange = function(){
        element.setAttribute('data-readystate', request.readyState);
        if (request.readyState == 4 && request.status < 400){
          requestCallback(element, request);
        }
      };
      ['error', 'abort', 'load'].forEach(function(type){
        request['on' + type] = function(event){
          event.request = request;
          xtag.fireEvent(element, type, event);
        }
      });
      request.open(request.method , request.url, true);
      request.setRequestHeader('Content-Type',
        'application/x-www-form-urlencoded');
      request.send();
    }
    else {
      var callbackID = request.callbackID = 'x' + new Date().getTime();
      element.setAttribute('data-readystate', request.readyState = 0);
      xtag.callbacks[callbackID] = function(data){
        request.status = 200;
        request.readyState = 4;
        request.responseText = data;
        requestCallback(element, request);
        delete xtag.callbacks[callbackID];
        clearRequest(element);
      }
      request.script = document.createElement('script');
      request.script.type = 'text/javascript';
      request.script.src = options.url = options.url +
        (~options.url.indexOf('?') ? '&' : '?') + callbackKey + callbackID;
      request.script.onerror = function(error){
        element.setAttribute('data-readystate', request.readyState = 4);
        element.setAttribute('data-requeststatus', request.status = 400);
        xtag.fireEvent(element, 'error', error);
      }
      head.appendChild(request.script);
    }
    element.xtag.request = request;
  }

  function requestCallback(element, request){
    if (request != element.xtag.request) return xtag;
    element.setAttribute('data-readystate', request.readyState);
    element.setAttribute('data-requeststatus', request.status);
    xtag.fireEvent(element, 'dataready', { request: request });
    if (element.dataready) element.dataready.call(element, request);
  }

  function clearRequest(element){
    var req = element.xtag.request;
    if (!req) return xtag;
    if (req.script && ~xtag.toArray(head.children).indexOf(req.script)) {
      head.removeChild(req.script);
    }
    else if (req.abort) req.abort();
  }


  xtag.mixins['request'] = {
    lifecycle:{
      created:  function(){
        this.src = this.getAttribute('src');
      }
    },
    accessors:{
      dataready:{
        get: function(){
          return this.xtag.dataready;
        },
        set: function(fn){
          this.xtag.dataready = fn;
        }
      },
      src:{
        set: function(src){
          if (src){
            this.setAttribute('src', src);
            request(this, { url: src, method: 'GET' });
          }
        },
        get: function(){
          return this.getAttribute('src');
        }
      }
    }
  };

})();

(function(){

  var oldiOS = /OS [1-4]_\d like Mac OS X/i.test(navigator.userAgent),
    oldDroid = /Android 2.\d.+AppleWebKit/.test(navigator.userAgent),
    gingerbread = /Android 2\.3.+AppleWebKit/.test(navigator.userAgent);

  if(oldDroid){
    //<meta name="viewport" content="width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;" />
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;';
    document.head.appendChild(meta);
  }

  window.addEventListener('keyup', function(event){
    if(event.keyCode == 27) xtag.query(document, 'x-modal[esc-hide]').forEach(function(modal){
      if (modal.getAttribute('hidden') === null) xtag.fireEvent(modal, 'modalhide');
    });
  });

  if (oldiOS || oldDroid) {
    window.addEventListener('scroll', function(event){
      var modals = xtag.query(document, 'body > x-modal');
      modals.forEach(function(m){
        m.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
      });
    });
  }

  xtag.register('x-modal', {
    mixins: ['request'],
    lifecycle: {
      created: function() {
        this.setAttribute('tabindex',0);
      },
      inserted: function() {
        if (oldiOS || oldDroid) {
          this.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
        }
      }
    },
    events: {
      'modalhide': function() {
        this.setAttribute('hidden', '');
      }
    },
    methods: {
      toggle: function() {
        if (this.hasAttribute('hidden')) {
          this.removeAttribute('hidden');
        } else {
          this.setAttribute('hidden','');
        }
      }
    }
  });

})();

(function(){

  xtag.register('x-panel', {
    mixins: ['request'],
    lifecycle:{
      created: function(){
        this.dataready = function(request){

          var frag = document.createDocumentFragment();
          var container = document.createElement('div');
          frag.appendChild(container);
          container.innerHTML = request.responseText;

          this.innerHTML = '';

          xtag.toArray(container.children).forEach(function(child){
            if (child.nodeName == 'SCRIPT'){
              var script = document.createElement('script');
              script.type = child.type;
              if (child.src.length>0){
                script.src = child.src;
              }else{
                script.appendChild(
                document.createTextNode(child.text||child.textContent||child.innerHTML));
              }
              this.appendChild(script);
            }
            else{
              this.appendChild(child);
            }
          }, this);
        };
      }
    }
  });
})();

(function(){

	xtag.register('x-shiftbox', {
		events:{
			'transitionend': function(e){
				if (e.target == xtag.queryChildren(this, 'x-content')[0]){
					if (this.shift.length){
						xtag.fireEvent(this, 'closed');
					}
					else {
						xtag.fireEvent(this, 'opened');
					}
				}
			}
		},
		accessors: {
			'shift': {
				attribute: {},
				get: function(){
					return this.getAttribute('shift') || '';
				}
			}
		},
		methods: {
			'toggle': function(){
				if (this.hasAttribute('open')){
					this.removeAttribute('open');
				} else {
					this.setAttribute('open','');
				}
			}
		}
	});

})();

(function(){

  var transform = xtag.prefix.js + 'Transform';
  function getState(el){
    var selected = xtag.query(el, 'x-slides > x-slide[selected]')[0] || 0;
    return [selected ? xtag.query(el, 'x-slides > x-slide').indexOf(selected) : selected, el.firstElementChild.children.length - 1];
  }

  function slide(el, index){
    var slides = xtag.toArray(el.firstElementChild.children);
    slides.forEach(function(slide){ slide.removeAttribute('selected'); });
    slides[index || 0].setAttribute('selected', null);
    el.firstElementChild.style[transform] = 'translate'+ (el.getAttribute('orientation') || 'x') + '(' + (index || 0) * (-100 / slides.length) + '%)';
  }

  function init(toSelected){
    var slides = this.firstElementChild;
    if (!slides || !slides.children.length || slides.tagName.toLowerCase() != 'x-slides') return;

    var children = xtag.toArray(slides.children),
      size = 100 / (children.length || 1),
      orient = this.getAttribute('orientation') || 'x',
      style = orient == 'x' ? ['width', 'height'] : ['height', 'width'];

    slides.style[style[1]] =  '100%';
    slides.style[style[0]] = children.length * 100 + '%';
    slides.style[transform] = 'translate' + orient + '(0%)';
    children.forEach(function(slide){
      slide.style[style[0]] = size + '%';
      slide.style[style[1]] = '100%';
    });

    if (toSelected) {
      var selected = slides.querySelector('[selected]');
      if (selected) slide(this, children.indexOf(selected) || 0);
    }
  }

  xtag.register('x-slidebox', {
    lifecycle: {
      created: function(){
        init();
      }
    },
    events:{
      'transitionend': function(e){
        if (e.target == this.firstElementChild){
          xtag.fireEvent(this, 'slideend');
        }
      }
    },
    accessors:{
      orientation:{
        get: function(){
          return this.getAttribute('orientation');
        },
        set: function(value){
          this.setAttribute('orientation', value.toLowerCase());
          init.call(this, true);
        }
      }
    },
    methods: {
      slideTo: function(index){
        slide(this, index);
      },
      slideNext: function(){
        var shift = getState(this);
          shift[0]++;
        slide(this, shift[0] > shift[1] ? 0 : shift[0]);
      },
      slidePrevious: function(){
        var shift = getState(this);
          shift[0]--;
        slide(this, shift[0] < 0 ? shift[1] : shift[0]);
      }
    }
  });

  xtag.register('x-slide', {
    lifecycle:{
      inserted: function(){
        var ancestor = this.parentNode.parentNode;
        if (ancestor.tagName.toLowerCase() == 'x-slidebox') init.call(ancestor, true);
      },
      created: function(e){
        if (this.parentNode){
          var ancestor = this.parentNode.parentNode;
          if (ancestor.tagName.toLowerCase() == 'x-slidebox') init.call(ancestor, true);
        }
      }
    }
  });

})();
(function(){

  function updateSize(el) {
    var oWidth = el.offsetWidth;
    el.xtag.img.style.borderWidth = oWidth * 0.1 + 'px';
    el.xtag.textEl.style.lineHeight = oWidth + 'px';
    el.style.fontSize = oWidth + 'px';
  }

  var emptyGif = 'data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

  xtag.register('x-spinner', {
    lifecycle: {
      created: function(){
        this.xtag.textEl = document.createElement('b');
        this.xtag.img = document.createElement('img');
        this.xtag.img.src = emptyGif;
        this.appendChild(this.xtag.textEl);
        this.appendChild(this.xtag.img);
        updateSize(this);
      },
      inserted: function() {
        updateSize(this);
      }
    },
    methods: {
      toggle: function(){
        this.paused = this.paused ? false : true;
      }
    },
    accessors: {
      paused: {
        attribute: { boolean: true }
      },
      label: {
        attribute: {},
        set: function(text) {
          this.xtag.textEl.innerHTML = text;
        }
      },
      duration: {
        attribute: {},
        set: function(duration) {
          var val = (+duration || 1) + 's';
          this.xtag.img.style[xtag.prefix.js + 'AnimationDuration'] = val;
          this.xtag.img.style.animationDuration = val;
        },
        get: function() {
          return +this.getAttribute('duration');
        }
      },
      reverse: {
        attribute: {
          boolean: true
        },
        set: function(val) {
          val = val ? 'reverse' : 'normal';
          this.xtag.img.style[xtag.prefix.js + 'AnimationDirection'] = val;
          this.xtag.img.style.animationDirection = val;
        }
      },
      src: {
        attribute: {
          property: 'img'
        },
        set: function(src) {
          if (!src) {
            this.xtag.img.src = emptyGif;
          }
        }
      }
    }
  });

})();

(function(){

  var template =  '<input type="hidden" />' +
  '<div>' +
    '<div class="x-switch-text" ontext="ON" offtext="OFF"></div>' +
    '<div><div class="x-switch-knob"><br/></div></div>' +
    '<div class="x-switch-knob">' +
      '<div class="x-switch-background">' +
        '<div class="x-switch-text x-switch-on" ontext="ON" offtext="OFF"></div>' +
        '<div><div class="x-switch-knob"><br/></div></div>' +
        '<div class="x-switch-text x-switch-off" ontext="ON" offtext="OFF"></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  function textSetter(state){
    return {
      attribute: { name: state + 'text' },
      get: function(){
        var attrValue = this.getAttribute(state + 'text');
        return attrValue !== null ? attrValue : state;
      },
      set: function(text){
        xtag.query(this, '[' + state + 'text]').forEach(function(el){
          el.setAttribute(state + 'text', text);
        });
      }
    };
  }

  xtag.register('x-switch', {
    lifecycle: {
      created: function(){
        this.setAttribute('tabindex', this.getAttribute('tabindex') || 0);
        this.innerHTML = template;
        this.onText = this.onText;
        this.offText = this.offText;
        this.checked = this.checked;
        this.formName = this.formName;
      }
    },
    methods: {
      toggle: function(state){
        this.checked = typeof state == 'undefined' ? (this.checked ? false : true) : state;
      }
    },
    events:{
      'tapend:preventable:delegate(div)': function(e){
        if (!e.currentTarget.disabled){
          e.currentTarget.checked = !e.currentTarget.checked;
        }
      },
      'keydown:preventable:keypass(32)': function(){
        if (!this.disabled){
          this.checked = !this.checked;
        }
      }
    },
    accessors: {
      onText: textSetter('on'),
      offText: textSetter('off'),
      checked: {
        attribute: { boolean: true },
        set: function(state){
          this.firstElementChild.value = !!state;
        }
      },
      disabled: {
        attribute: { boolean: true, selector: 'input' }
      },
      formName: {
        attribute: { name: 'formname' },
        get: function(){
          return this.firstElementChild.getAttribute('name') || this.getAttribute('formName');
        },
        set: function(value){
          this.firstElementChild.setAttribute('name', value);
        }
      }
    }
  });

})();

(function(){

  function setScope(toggle){
    var form = toggle.firstChild.form;
    form ? toggle.removeAttribute('x-toggle-no-form') : toggle.setAttribute('x-toggle-no-form', '');
    toggle.xtag.scope = toggle.parentNode ? form || document : null;
  }
  
  function updateScope(scope){
    var names = {},
        docSelector = scope == document ? '[x-toggle-no-form]' : '';
    xtag.query(scope, 'x-toggle[name]' + docSelector).forEach(function(toggle){
      var name = toggle.name;
      if (name && !names[name]) {
        var named = xtag.query(scope, 'x-toggle[name="' + name + '"]' + docSelector),
            type = named.length > 1 ? 'radio' : 'checkbox';
        named.forEach(function(toggle){
          if (toggle.firstChild) toggle.firstChild.type = type;
        });
        names[name] = true;
      } 
    });
  }
  
  var shifted = false;
  xtag.addEvents(document, {
    'DOMComponentsLoaded': function(){
      updateScope(document);
      xtag.toArray(document.forms).forEach(updateScope);
    },
    'WebComponentsReady': function(){
      updateScope(document);
      xtag.toArray(document.forms).forEach(updateScope);
    },
    'keydown': function(e){
      shifted = e.shiftKey;
    },
    'keyup': function(e){
      shifted = e.shiftKey;
    },
    'focus:delegate(x-toggle)': function(e){
      this.setAttribute('focus', '');
    },
    'blur:delegate(x-toggle)': function(e){
      this.removeAttribute('focus');
    },
    'tap:delegate(x-toggle)': function(e){
      if (shifted && this.group) {
        var toggles = this.groupToggles,
            active = this.xtag.scope.querySelector('x-toggle[group="'+ this.group +'"][active]');
        if (active && this != active) {
          var self = this,
              state = active.checked,
              index = toggles.indexOf(this),
              activeIndex = toggles.indexOf(active);
          toggles.slice(Math.min(index, activeIndex), Math.max(index, activeIndex)).forEach(function(toggler){
            if (toggler != self) toggler.checked = state;
          });
        }
      }
    },
    'change:delegate(x-toggle)': function(e){
      var active = this.xtag.scope.querySelector('x-toggle[group="'+ this.group +'"][active]');
      this.checked = (shifted && active && (this != active)) ? active.checked : this.firstChild.checked;
      if (this.group) {
        this.groupToggles.forEach(function(toggle){
          toggle.active = false;
        });
        this.active = true;
      }
    }
  });  
  
  xtag.register('x-toggle', {
    lifecycle: {
      created: function(){
        this.innerHTML = '<input type="checkbox" /><div class="x-toggle-check"></div>';
        setScope(this);
        var name = this.getAttribute('name');
        if (name) this.firstChild.name = this.getAttribute('name');
        if (this.hasAttribute('checked')) this.checked = true;
      },
      inserted: function(){
        setScope(this);
        if (this.name) updateScope(this.xtag.scope);
      },
      removed: function(){
        updateScope(this.xtag.scope);
        setScope(this);
      }
    },
    accessors: {
      label: { attribute: {} },
      active: { attribute: { boolean: true } },
      group: { attribute: {} },
      groupToggles: {
        get: function(){
          return xtag.query(this.xtag.scope, 'x-toggle[group="' + this.group + '"]');
        }
      },
      name: {
        attribute: {},
        get: function(){
          return this.getAttribute('name');
        },
        set: function(name){
          if (name === null) {
            this.removeAttribute('name');
            this.firstChild.type = 'checkbox';
          }
          else this.firstChild.name = name;
          updateScope(this.xtag.scope);
        }
      },
      checked: {
        get: function(){
          return this.firstChild.checked;
        },
        set: function(value){
          var name = this.name,
              state = (value == 'true' || value === true);
          if (name) {
            var previous = xtag.query(this.xtag.scope, 'x-toggle[checked][name="' + name + '"]' + (this.xtag.scope == document ? '[x-toggle-no-form]' : ''))[0];
            if (previous) previous.removeAttribute('checked'); 
          }
          this.firstChild.checked = state;
          state ? this.setAttribute('checked', '') : this.removeAttribute('checked');
        }
      }
    }
  });
  
})();