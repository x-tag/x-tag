(function(){
  
  var doc = document,
  	win = window,
  	head = doc.getElementsByTagName('head')[0];

  var nodeInserted = function(element, query){
    if (query && xtag.tagList.length && element.childNodes.length){ 
      xtag.query(element, xtag.tagList).forEach(function(element){ 
        nodeInserted(element) 
      });
    }
    xtag.extendElement(element, true);
    if (element.parentNode) xtag.getOptions(element).onInsert.call(element);
  };

  /**
  * Object containing various vendor specific details such as the CSS prefix
  * to use for the current browser.
  *
  * The following keys are set in the object:
  *
  * * css: the CSS prefix
  * * dom: the DOM prefix
  * * js: the Javascript prefix 
  * * lowercase: a lower cased version of the browser prefix
  *
  * An example of this object on Chromium is the following 
  *
  * {
  * css: "-webkit-"
  * dom: "WebKit"
  * js: "Webkit"
  * keyframes: true
  * lowercase: "webkit"  
  * }
  */
  var prefix = (function() {
    var styles = win.getComputedStyle(doc.documentElement, '');
    
    var pre = (
        Array.prototype.slice
        .call(styles)
        .join('')
        .match(/moz|webkit|ms/) || (styles.OLink===''&&['o'])
      )[0];

    var dom = ('WebKit|Moz|MS|O')
        .match(new RegExp('(' + pre + ')', 'i'))[1];

    return {
      dom: dom,
      lowercase: pre,
      css: '-' + pre + '-',
      js: pre[0].toUpperCase() + pre.substr(1)
    };
  })();

  /**
  * Stores the value of `current` in `source` using the key specified in
  * `key`.
  *
  * @param {object} source The object to store the value of the third
  * parameter.
  * @param {string} key The key under which to store the value.
  * @param {object|array} current The value to store in the object
  * specified in the `source` parameter.
  * @return {object}
  */
  var  mergeOne = function(source, key, current){
    switch (xtag.typeOf(current)){
      case 'object':
        if (xtag.typeOf(source[key]) == 'object'){
          xtag.merge(source[key], current);
        } else source[key] = xtag.clone(current);
      break;
      case 'array': source[key] = xtag.toArray(current); break;
      default: source[key] = current;
    }
    return source;
  };

  /**
  * Calls the function in `fn` when the string in `value` contains an event
  * key code that matches a triggered event.
  *
  * @param {function} fn The function to call.
  * @param {string} value String containing the event key code.
  * @param {string} pseudo
  */
  var keypseudo = {
    listener: function(pseudo, fn, args){
      if (!!~pseudo.value.match(/(\d+)/g).indexOf(String(args[0].keyCode)) 
        == (pseudo.name == 'keypass')){
        args.splice(args.length, 0, this);
        fn.apply(this, args);
      }
    }
  };

  var touchMap = {
    mouseenter: 'touchenter',
    mouseleave: 'touchleave',
    mousedown: 'touchstart',
    mousemove: 'touchmove',
    mouseup: 'touchend',
    click: 'touchend'
  };
  
  xtag = {
    tags: {},
    tagList: [],
    callbacks: {},
    prefix: prefix,
    anchor: doc.createElement('a'),
    mutation: win.MutationObserver || 
      win.WebKitMutationObserver || 
      win.MozMutationObserver,
    tagOptions: {
      content: '',
      mixins: [],
      events: {},
      methods: {},
      getters: {},
      setters: {},
      onCreate: function(){},
      onInsert: function(){}
    },

    eventMap: {
      animationstart: [
        'animationstart', 
        'oAnimationStart', 
        'MSAnimationStart', 
        'webkitAnimationStart'
      ],
      transitionend: [
        'transitionend', 
        'oTransitionEnd', 
        'MSTransitionEnd', 
        'webkitTransitionEnd'
      ], 
      tap: [ 'ontouchend' in doc ? 'touchend' : 'mouseup']
    },
    pseudos: {
      delegate: {
        listener: function(pseudo, fn, args){
          var target = xtag.query(this, pseudo.value).filter(function(node){
            return node == args[0].target || 
              node.contains ? node.contains(args[0].target) : false;
          })[0];
          args.splice(args.length, 0, this);
          return target ? fn.apply(target, args) : false;
        }
      },
      preventable: { 
        listener: function(pseudo, fn, args){
          if (!args[0].defaultPrevented) fn.apply(this, args);
        }
      },
      attribute: {
        onAdd: function(pseudo){
          this.xtag.attributeSetters = this.xtag.attributeSetters || {};
          this.xtag.attributeSetters[pseudo.value] = pseudo.key.split(':')[0];
        },
        listener: function(pseudo, fn, args){
          fn.call(this, args[0]);
          this.setAttribute(pseudo.value, args[0], true);
        }
      },
      touch: {
        onAdd: function(pseudo, fn){
          this.addEventListener(touchMap[pseudo.key.split(':')[0]], fn, false);
        },
        listener: function(pseudo, fn, args){
          if (fn.touched && args[0].type.match('mouse')){
            fn.touched = false;
          } else {
            if (args[0].type.match('touch')) fn.touched = true;
            args.splice(args.length, 0, this);
            fn.apply(this, args);
          }
        }, 
        onRemove: function(pseudo, fn){
          this.removeEventListener(touchMap[pseudo.key.split(':')[0]], fn);
        }
      },
      keystop: keypseudo,
      keypass: keypseudo
    },

    /**
    * Object containing various mixins that can be used when creating
    * custom tags.
    *
    * When registering a new tag you can specify these mixins as
    * following:
    *
    * xtag.register('tag-name', {
    * mixins: ['mixin1', 'mixin2', 'etc']
    * });
    */
    mixins: {
      request: {
        onInsert: function(){
          this.src = this.getAttribute('src');
        },
        getters: {
          dataready: function(){
            return this.xtag.dataready;
          }
        },
        setters: {
          src: function(src){
            if (src){
              this.setAttribute('src', src);
              xtag.request(this, { url: src, method: 'GET' });
            }
          },
          dataready: function(fn){
            this.xtag.dataready = fn;
            if (this.xtag.request && this.xtag.request.readyState == 4){
              fn.call(this, this.xtag.request);
            }
          }
        }
      }
    },
    
    /**
    * Returns a lowercased string containing the type of the object.
    *
    * @param {object} obj The object of which to retrieve the type.
    * @return {string}
    */
    typeOf: function(obj) {
      return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    },
  
    /**
    * Converts the given object to an array.
    *
    * @param {object} obj The object to convert.
    * @return {array}
    */
    toArray: function(obj){
      var sliced = Array.prototype.slice.call(obj, 0);
      return sliced.hasOwnProperty ? sliced : [obj];
    },

    /**
    * Returns a boolean that indicates if the element has the specified
    * class.
    *
    * @param {element} element The element for which to check the class.
    * @param {string} className The name of the class to check for.
    * @return {boolean}
    */
    hasClass: function(element, className){
      return !!~element.className.split(' ').indexOf(className);
    },

    /**
    * Adds the class to the specified element, existing classes will not
    * be overwritten.
    *
    * @param {element} element The element to add the class to.
    * @param {string} className The class to add.
    * @return {element}
    */
    addClass: function(element, className){
      if (!xtag.hasClass(element, className)){
        var names = element.className.split(' ')
          .filter(function(item){ return item != "" });
        names.push(className);
        element.className = names.join(' ');
      } 
      return element;
    },

    /**
    * Removes the given class from the element.
    *
    * @param {element} element The element from which to remove the class.
    * @param {string} className The class to remove.
    * @return {element}
    */
    removeClass: function(element, className){
      var names = element.className.split(' ')
        .filter(function(item){ return item != "" }),
        idx = names.indexOf(className);
      names.splice(idx,1);
      element.className = names.join(' ');
      return element;
    },

    /**
    * Toggles the class on the element. If the class is added it's
    * removed, if not it will be added instead.
    *
    * @param {element} element The element for which to toggle the class.
    * @param {string} className The class to toggle.
    * @return {element}
    */
    toggleClass: function(element, className){
      return !xtag.hasClass(element, className) ? 
        xtag.addClass(element,className) : xtag.removeClass(element, className);
    },
    
    /**
    * Queries a set of child elements using a CSS selector.
    *
    * @param {element} element The element to query.
    * @param {string} selector The CSS selector to use for the query.
    * @return {array}
    */
    query: function(element, selector){
      return xtag.toArray(element.querySelectorAll(selector));
    },
    
    queryChildren: function(element, selector){ 
      var result = null,
        id = 'x-' + new Date().getTime(),
        attr = '[xtag-temp-id="' + id + '"] > ',
        selector = attr + (selector + '').replace(',', ',' + attr, 'g');        
      element.setAttribute('xtag-temp-id', id);
      result = element.parentNode.querySelectorAll(selector);
      element.removeAttribute('xtag-temp-id');
      return xtag.toArray(result);
    },
    
    /**
    * Function that can be used to define a property on an element.
    *
    * @param {element} element The element on which to define the
    * property.
    * @param {string} property The property to define.
    * @param {string} accessor The accessor name.
    * @param {string} value The value of the property.
    */
    defineProperty: function(element, property, accessor, value){
      return doc.documentElement.__defineGetter__ ? 
        function(element, property, accessor, value){
          element['__define' + accessor[0].toUpperCase() + 
            'etter__'](property, value);
        } : 
        function(element, property, accessor, value){
          var obj = { configurable: true };
          obj[accessor] = value;
          Object.defineProperty(element, property, obj);
        };
    }(),

    /**
    * Creates a new function and sets the prototype to the specified
    * object.
    *
    * @param {object} obj The object to use as the prototype for the new
    * function.
    * @return {function}
    */    
    clone: function(obj) {
      var F = function(){};
      F.prototype = obj;
      return new F();
    },
    
    merge: function(source, k, v){
      if (xtag.typeOf(k) == 'string') return mergeOne(source, k, v);
      for (var i = 1, l = arguments.length; i < l; i++){
        var object = arguments[i];
        for (var key in object) mergeOne(source, key, object[key]);
      }
      return source;
    },
    
    wrap: function(original, fn){
      return function(){
        var args = xtag.toArray(arguments);
        original.apply(this, args);
        fn.apply(this, args);
      }
    },

    skipTransition: function(element, fn, bind){
      var duration = prefix.js + 'TransitionDuration';
      element.style[duration] = '0.001s';
      fn.call(bind);
      xtag.addEvent(element, 'transitionend', function(){
        element.style[duration] = '';
      });
    },
    
    /**
    * Checks if the specified element is an x-tag element or a regular
    * element.
    *
    * @param {element} element The element to check.
    * @return {boolean}
    */    
    tagCheck: function(element){
      return element.tagName ? xtag.tags[element.tagName.toLowerCase()] : false;
    },
    
    /**
    * Returns an object containing the options of an element.
    *
    * @param {element} element The element for which to retrieve the
    * options.
    * @return {object}
    */
    getOptions: function(element){
      return xtag.tagCheck(element) || xtag.tagOptions;
    },
    
    /**
    * Registers a new x-tag object.
    *
    * @param {string} tag The name of the tag.
    * @param {object} options An object containing custom configuration
    * options to use for the tag.
    */
    register: function(tag, options){
      xtag.tagList.push(tag);
      xtag.tags[tag] = xtag.merge({ tagName: tag }, xtag.tagOptions, 
        xtag.applyMixins(options || {}));
      if (xtag.domready) xtag.query(doc, tag).forEach(nodeInserted);
    },
    
    /**
    * Extends an element by adding various x-tag related getters, setters
    * and other properties to it.
    *
    * @param {element} element The element to extend.
    */
    extendElement: function(element, insert){
      if (!element.xtag){
        element.xtag = {}; // used as general storage
        var options = xtag.getOptions(element);
        for (var z in options.methods){
          xtag.bindMethod(element, z, options.methods[z]);
        }
        for (var z in options.setters){
          xtag.applyAccessor(element, z, 'set', options.setters[z]);
        }
        for (var z in options.getters){
          xtag.applyAccessor(element, z, 'get', options.getters[z]);
        }
        xtag.addEvents(element, options.events);
        if (options.content) element.innerHTML = options.content;
        options.onCreate.call(element);
      }
    },

    /**
    * Binds a method to the specified element under the given key.
    *
    * @param {element} element The element to bind the method to.
    * @param {string} key The name of the key in which to store the
    * method.
    * @param {function} method The method/function to bind to the element.
    */
    bindMethod: function(element, key, method){
      element[key] = function(){ 
        return method.apply(element, xtag.toArray(arguments)) 
      };
    },
    
    applyMixins: function(options){
      if (options.mixins){ 
        options.mixins.forEach(function(name){
          var mixin = xtag.mixins[name];
          for (var z in mixin) {
            switch (xtag.typeOf(mixin[z])){
              case 'function': 
                options[z] = options[z] ? 
                  xtag.wrap(options[z], mixin[z]) : mixin[z];
                break;
              case 'object': 
                options[z] = xtag.merge({}, mixin[z], options[z]);
                break;
              default: 
                options[z] = mixin[z];
            }
          }
        });
      }
      return options;
    },
    
    applyAccessor: function(element, key, accessor, fn){
      xtag.defineProperty(element, 
        key.split(':')[0], accessor, xtag.applyPseudos(element, key, fn));
    }, 
    
    applyPseudos: function(element, key, fn){
      var action = fn, onAdd = {};
      if (key.match(':')){
        key.replace(/:(\w*)(?:\(([^\)]*)\))?/g, function(match, name, value){
          var lastPseudo = action,
            pseudo = xtag.pseudos[name],
            split = {
              key: key, 
              name: name,
              value: value
            };
          if (pseudo.onAdd) onAdd[name] = split;
          action = function(){
            return pseudo.listener.apply(element, 
              [split, fn, xtag.toArray(arguments)]);
          }
        });
        for (var z in onAdd){
          xtag.pseudos[z].onAdd.call(element, onAdd[z], action);
        }
      }
      return action;
    },

    removePseudos: function(element, key, fn){
      if (key.match(':')){
        key.replace(/:(\w*)(?:\(([^\)]*)\))?/g, function(match, name, value){
          var pseudo = xtag.pseudos[name];
          if (pseudo.onRemove) pseudo.onRemove.call(element, {
              key: key, 
              name: name,
              value: value
            }, fn);
          
        });
      }
    },
    
    request: function(element, options){
      xtag.clearRequest(element);
      var last = element.xtag.request || {};
        element.xtag.request = options;
      var request = element.xtag.request,
        callbackKey = element.getAttribute('data-callback-key') ||
          'callback' + '=xtag.callbacks.';
      if (xtag.fireEvent(element, 'beforerequest') === false) return false;
      if (last.url && !options.update && 
        last.url.replace(new RegExp('\&?\(' + callbackKey + 'x[0-9]+)'), '') ==
          element.xtag.request.url){
        element.xtag.request = last;
        return false;
      }
      element.setAttribute('src', element.xtag.request.url);
      xtag.anchor.href = options.url;
      if (xtag.anchor.hostname == win.location.hostname) {
        request = xtag.merge(new XMLHttpRequest(), request);
        request.onreadystatechange = function(){
          element.setAttribute('data-readystate', request.readyState);
          if (request.readyState == 4 && request.status < 400){
            xtag.requestCallback(element, request);
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
          xtag.requestCallback(element, request);
          delete xtag.callbacks[callbackID];
          xtag.clearRequest(element);
        }
        request.script = doc.createElement('script');
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
    },
    
    requestCallback: function(element, request){
      if (request != element.xtag.request) return xtag;
      element.setAttribute('data-readystate', request.readyState);
      element.setAttribute('data-requeststatus', request.status);         
      xtag.fireEvent(element, 'dataready', { request: request });
      if (element.dataready) element.dataready.call(element, request);
    },
    
    clearRequest: function(element){
      var req = element.xtag.request;
      if (!req) return xtag;
      if (req.script && ~xtag.toArray(head.children).indexOf(req.script)) {
        head.removeChild(req.script);
      }
      else if (req.abort) req.abort();
    },
	
    addEvent: function(element, type, fn){
      var eventKey = type.split(':')[0],
        eventMap = xtag.eventMap[eventKey] || [eventKey];
      var wrapped = xtag.applyPseudos(element, type, fn);
      eventMap.forEach(function(name){
        element.addEventListener(name, 
          wrapped, !!~['focus', 'blur'].indexOf(name));
      });
      return wrapped;
    },
    
    addEvents: function(element, events){
      for (var z in events) xtag.addEvent(element, z, events[z]);
    },
	
	removeEvent: function(element, type, fn){
      var eventKey = type.split(':')[0],
        eventMap = xtag.eventMap[eventKey] || [eventKey];   
      eventMap.forEach(function(name){
        element.removeEventListener(name, fn);
      });
    },
	
	fireEvent: function(element, type, data, options){
      var options = options || {},
	    event = doc.createEvent('Event');
      event.initEvent(type, 'bubbles' in options ? options.bubbles : true, 'cancelable' in options ? options.cancelable : true);
      element.dispatchEvent(xtag.merge(event, data));
    },
    
    observe: function(element, fn){
      if (xtag.mutation){
        var mutation = new xtag.mutation(function(mutations) {
          var added = [];
          mutations.forEach(function(record){
            var nodes = record.addedNodes, length = nodes.length;
            for (i = 0; i < length && added.indexOf(nodes[i]) == -1; i++){
              added.push(nodes[i]);
              fn(nodes[i], true);
            }
          });
        });
        mutation.observe(element, {
          subtree: true,
          childList: true,
          attributes: !true,
          characterData: false
        });
      }
      else element.addEventListener('DOMNodeInserted', function(event){
        fn(event.target);
      }, false);
    }
  };
  
  var setAttribute = HTMLElement.prototype.setAttribute;
  (win.HTMLUnknownElement || HTMLElement).prototype.setAttribute = function(attr, value, setter){
    if (!setter && this.xtag && this.xtag.attributeSetters){
      this[this.xtag.attributeSetters[attr]] = value;
    }
    setAttribute.call(this, attr, value);
  };
  
  var createElement = doc.createElement;
  doc.createElement = function(tag){
    var element = createElement.call(this, tag);
    if (xtag.tagCheck(element)) xtag.extendElement(element);
    return element;
  };
  
  function init(){
    xtag.observe(doc.documentElement, nodeInserted);
    if (xtag.tagList.length){
      xtag.query(doc, xtag.tagList).forEach(function(element){
        nodeInserted(element);
      });
    }
    xtag.domready = true;
    xtag.fireEvent(doc, 'DOMComponentsLoaded');
    xtag.fireEvent(doc, '__DOMComponentsLoaded__');
  }

  if (doc.readyState === 'complete') init();
  else {
    doc.addEventListener('DOMContentLoaded', function(event){
      init();
    }, false);
  }
  
  if (typeof define == 'function' && define.amd) define(xtag);
  
})();