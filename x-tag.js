/*global window: true, document: true, xtag: true, XMLHttpRequest: true*/
(function() {
    "use strict";

    var head = document.getElementsByTagName('head')[0];

    /**
     * Object containing various vendor specific details such as the CSS prefix
     * to use for the current browser.
     *
     * The following keys are set in the object:
     *
     * * css: the CSS prefix
     * * dom: the DOM prefix
     * * js: the Javascript prefix
     * * keyframes: a boolean that indicates if the browser supports CSS
     *   keyframes
     * * lowercase: a lower cased version of the browser prefix
     * * properties: the CSS properties to use for animating objects
     *
     * An example of this object on Chromium is the following (the properties
     * value has been wrapped for readability):
     *
     *     {
     *         css: "-webkit-"
     *         dom: "WebKit"
     *         js: "Webkit"
     *         keyframes: true
     *         lowercase: "webkit"
     *         properties: "{animation-duration: 0.0001s;animation-name:" +
     *             " nodeInserted !important;-webkit-animation-duration: " +
     *             "0.0001s;-webkit-animation-name: nodeInserted !important;}"
     *     }
     */
    var prefix = (function() {
        var styles = window.getComputedStyle(document.documentElement, '');

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
            js: pre[0].toUpperCase() + pre.substr(1),
            keyframes: !!(window.CSSKeyframesRule ||
                window[dom + 'CSSKeyframesRule'])
        };
    })();

    /**
     * Stores the value of `current` in `source` using the key specified in
     * `key`.
     *
     * @param  {object} source The object to store the value of the third
     *  parameter.
     * @param  {string} key The key under which to store the value.
     * @param  {object|array} current The value to store in the object
     *  specified in the `source` parameter.
     * @return {object}
     */
    var mergeOne = function(source, key, current) {
        switch (xtag.typeOf(current)) {
            case 'object':
                if (xtag.typeOf(source[key]) === 'object') {
                    xtag.merge(source[key], current);
                }
                else {
                    source[key] = xtag.clone(current);
                }
                break;

            case 'array':
                source[key] = xtag.toArray(current);
                break;

            default:
                source[key] = current;
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
    var keypseudo = function(fn, value, pseudo){
        return function(event){
            if (!!~value.match(/(\d+)/g).indexOf(String(event.keyCode)) ===
            (pseudo === 'keypass')) {
                fn.apply(this, xtag.toArray(arguments));
            }
        };
    };

    xtag = {
        tags: {},
        tagList: [],
        callbacks: {},
        prefix: prefix,
        anchor: document.createElement('a'),
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
        /**
         * Object containing the various events for particular actions. For
         * example, the key "animationstart" contains the possible event names
         * that are used when an animation starts.
         */
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
            tap: [document.ontouchend ? 'touchend' : 'mouseup']
        },
        pseudos: {
            delegate: function(fn, value, pseudo, event) {
                var target = xtag.query(this, value).filter(function(node) {
                    return node === event.target || node.contains ?
                        node.contains(event.target) :
                        false;
                })[0];

                var func = function() {
                    fn.apply(target, xtag.toArray(arguments));
                };

                return target ? func : false;
            },

            keystop: keypseudo,
            keypass: keypseudo,

            retain: function(fn, value, pseudo, property, element) {
                var current = element[property];

                return function() {
                    fn();

                    if (typeof current !== 'undefined') {
                        element[property] = current;
                    }
                };
            },

            preventable: function(fn, value, pseudo) {
                return function(event) {
                    if (!event.defaultPrevented) {
                        fn.apply(this, xtag.toArray(arguments));
                    }
                };
            }
        },

        /**
         * Object containing various mixins that can be used when creating
         * custom tags.
         *
         * When registering a new tag you can specify these mixins as
         * following:
         *
         *     xtag.register('tag-name', {
         *         mixins: ['mixin1', 'mixin2', 'etc']
         *     });
         */
        mixins: {
            request: {
                /**
                 * Function that is called whenever the tag is inserted into
                 * the DOM. This function uses the `src` setter to set the
                 * source of the element as well as triggering the events bound
                 * to this action.
                 */
                onInsert: function() {
                    this.src = this.getAttribute('src');
                },

                getters: {
                    'dataready:retain': function(){
                        return this.xtag.dataready;
                    }
                },

                setters: {
                    /**
                     * Sets the `src` attribute of the tag and executes an Ajax
                     * call to the specified source URL.
                     *
                     * @param {string} src The source URL.
                     */
                    src: function(src){
                        if (src){
                            this.setAttribute('src', src);
                            xtag.request(this, { url: src, method: 'GET' });
                        }
                    },
                    'dataready:retain': function(fn) {
                        this.xtag.dataready = fn;

                        if (this.xtag.request &&
                        this.xtag.request.readyState === 4) {
                            fn.call(this, this.xtag.request);
                        }
                    }
                }
            }
        },

        /**
         * Returns a lowercased string containing the type of the object.
         *
         * @param  {object} obj The object of which to retrieve the type.
         * @return {string}
         */
        typeOf: function(obj) {
          return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
        },

        /**
         * Converts the given object to an array.
         *
         * @param  {object} obj The object to convert.
         * @return {array}
         */
        toArray: function(obj) {
            var sliced = Array.prototype.slice.call(obj, 0);

            return sliced.hasOwnProperty ? sliced : [obj];
        },

        /**
         * Returns a boolean that indicates if the element has the specified
         * class.
         *
         * @param  {element} element The element for which to check the class.
         * @param  {string} className The name of the class to check for.
         * @return {boolean}
         */
        hasClass: function(element, className) {
            return !!~element.className.split(' ').indexOf(className);
        },

        /**
         * Adds the class to the specified element, existing classes will not
         * be overwritten.
         *
         * @param  {element} element The element to add the class to.
         * @param  {string} className The class to add.
         * @return {element}
         */
        addClass: function(element, className) {
            if (!xtag.hasClass(element, className)) {
                element.className = (element.className + ' ' + className);
            }

            return element;
        },

        /**
         * Removes the given class from the element.
         *
         * @param  {element} element The element from which to remove the class.
         * @param  {string} className The class to remove.
         * @return {element}
         */
        removeClass: function(element, className) {
            element.className = element.className
                .replace(new RegExp('(^|\\s)' + className + '(?:\\s|$)'), '$1');

            return element;
        },

        /**
         * Toggles the class on the element. If the class is added it's
         * removed, if not it will be added instead.
         *
         * @since  2012-06-21
         * @param  {element} element The element for which to toggle the class.
         * @param  {string} className The class to toggle.
         * @return {element}
         */
        toggleClass: function(element, className) {
            return !xtag.hasClass(element, className) ?
                xtag.addClass(element,className) :
                xtag.removeClass(element, className);
        },

        /**
         * Queries a set of child elements using a CSS selector.
         *
         * @param  {element} element The element to query.
         * @param  {string} selector The CSS selector to use for the query.
         * @return {array}
         */
        query: function(element, selector) {
            return xtag.toArray(element.querySelectorAll(selector));
        },

        /**
         * Function that can be used to define a property on an element.
         *
         * @param {element} element The element on which to define the
         *  property.
         * @param {string} property The property to define.
         * @param {string} accessor The accessor name.
         * @param {string} value The value of the property.
         */
        defineProperty: (function(element, property, accessor, value) {
            var func;

            if (document.documentElement.__defineGetter__) {
                func = function(element, property, accessor, value) {
                    element[
                        '__define' + accessor[0].toUpperCase() + 'etter__'
                    ](property, value);
                };
            }
            else {
                func = function(element, property, accessor, value) {
                    var obj = { configurable: true };
                    obj[accessor] = value;

                    Object.defineProperty(element, property, obj);
                };
            }

            return func;
        })(),

        /**
         * Creates a new function and sets the prototype to the specified
         * object.
         *
         * @param {object} obj The object to use as the prototype for the new
         *  function.
         * @return {function}
         */
        clone: function(obj) {
            var F = function(){};
            F.prototype = obj;

            return new F();
        },

        merge: function(source, k, v) {
            if (xtag.typeOf(k) === 'string') {
                return mergeOne(source, k, v);
            }

            var arg_length = arguments.length;
            var i;
            var object;
            var key;

            for (i = 1; i < arg_length; i++) {
                object = arguments[i];

                for (key in object) {
                    mergeOne(source, key, object[key]);
                }
            }

            return source;
        },

        wrap: function(original, fn) {
            return function() {
                var args = xtag.toArray(arguments);

                original.apply(this, args);
                fn.apply(this, args);
            };
        },

        skipTransition: function(element, fn, bind) {
            var duration = prefix.js + 'TransitionDuration';
            element.style[duration] = '0.001s';

            fn.call(bind);

            xtag.addEvent(element, 'transitionend', function() {
                element.style[duration] = '';
            });
        },

        /**
         * Checks if the specified element is an x-tag element or a regular
         * element.
         *
         * @param  {element} element The element to check.
         * @return {boolean}
         */
        tagCheck: function(element) {
            return element.tagName ?
                xtag.tags[element.tagName.toLowerCase()] :
                false;
        },

        /**
         * Returns an object containing the options of an element.
         *
         * @param {element} element The element for which to retrieve the
         *  options.
         * @return {object}
         */
        getOptions: function(element) {
            return xtag.tagCheck(element) || xtag.tagOptions;
        },

        /**
         * Registers a new x-tag object.
         *
         * @param {string} tag The name of the tag.
         * @param {object} options An object containing custom configuration
         *  options to use for the tag.
         */
        register: function(tag, options) {
            xtag.tagList.push(tag);

            xtag.tags[tag] = xtag.merge(
                {},
                xtag.tagOptions,
                xtag.applyMixins(options)
            );

            if (prefix.keyframes) {
                xtag.attachKeyframe(tag);
            }
            else if (xtag.domready) {
                xtag.query(document, tag).forEach(function(element) {
                    nodeInserted(
                        { target: element, animationName: 'nodeInserted' }
                    );
                });
            }
        },

        attachKeyframe: function(tag) {
            xtag.sheet.insertRule(tag + prefix.properties, 0);
        },

        extendElement: function(element) {
            if (!element.xtag) {
                element.xtag = {};
                var options = xtag.getOptions(element);

                var z;

                for (z in options.methods) {
                    xtag.bindMethods(element, z, options.methods[z]);
                }

                for (z in options.setters) {
                    xtag.applyAccessor(element, z, 'set', options.setters[z]);
                }

                for (z in options.getters) {
                    xtag.applyAccessor(element, z, 'get', options.getters[z]);
                }

                xtag.addEvents(element, options.events, options.eventMap);

                if (options.content) {
                    element.innerHTML = options.content;
                }

                options.onCreate.call(element);
            }
        },

        bindMethods: function(element, key, method) {
            element.xtag[key] = function() {
                return method.apply(element, xtag.toArray(arguments));
            };
        },

        applyMixins: function(options) {
            if (options.mixins) {
                options.mixins.forEach(function(name) {
                    var mixin = xtag.mixins[name];
                    var z;

                    for (z in mixin) {
                        switch (xtag.typeOf(mixin[z])) {
                            case 'function':
                                options[z] = options[z] ?
                                    xtag.wrap(options[z], mixin[z]) :
                                    mixin[z];
                                break;

                            case 'object':
                                options[z] = xtag.merge(
                                    {},
                                    mixin[z],
                                    options[z]
                                );
                                break;

                            default: options[z] = mixin[z];
                        }
                    }
                });
            }

            return options;
        },

        applyAccessor: function(element, pseudo, accessor, value) {
            var property = pseudo.split(':')[0];

            xtag.applyPseudos(element, pseudo, function() {
                xtag.defineProperty(element, property, accessor, value);
            }, [property, element]);
        },

        applyPseudos: function(element, key, fn, args) {
            var action = fn;

            args = xtag.toArray(args);

            if (key.match(':')) {
                key.replace(
                    /:(\w*)(?:\(([^\)]*)\))?/g,
                    function(match, pseudo, value) {
                        if (action){
                            var passed = xtag.toArray(args);

                            passed.unshift(action, value, pseudo);

                            var returned = xtag.pseudos[pseudo]
                                .apply(element, passed);

                            action = returned === false ?
                                false :
                                returned || fn;
                        }
                    }
                );
            }

            if (action) {
                action.apply(element, args);
            }
        },

        request: function(element, options) {
            xtag.clearRequest(element);

            var last = element.xtag.request || {};

            element.xtag.request = options;

            var request = element.xtag.request,
                callbackKey = element.getAttribute('data-callback-key') ||
                    'callback' + '=xtag.callbacks.';

            if (xtag.fireEvent(element, 'beforerequest') === false) {
                return false;
            }

            if (last.url && !options.update) {
                var replaced = last.url.replace(
                    new RegExp('&?(' + callbackKey + 'x[0-9]+)'),
                    ''
                );

                if (replaced === element.xtag.request.url) {
                    element.xtag.request = last;

                    return false;
                }
            }

            element.setAttribute('src', element.xtag.request.url);

            xtag.anchor.href = options.url;

            if (xtag.anchor.hostname === window.location.hostname) {
                request = xtag.merge(new XMLHttpRequest(), request);

                request.onreadystatechange = function() {
                    element.setAttribute('data-readystate', request.readyState);

                    if (request.readyState === 4 && request.status < 400) {
                        xtag.requestCallback(element, request);
                    }
                };

                ['error', 'abort', 'load'].forEach(function(type) {
                    request['on' + type] = function(event) {
                        event.request = request;
                        xtag.fireEvent(element, type, event);
                    };
                });

                request.open(request.method , request.url, true);

                request.setRequestHeader(
                    'Content-Type',
                    'application/x-www-form-urlencoded'
                );

                request.send();
            }
            else {
                var callbackID = request.callbackID = 'x' +
                    new Date().getTime();

                element.setAttribute('data-readystate', request.readyState = 0);

                xtag.callbacks[callbackID] = function(data) {
                    request.status = 200;
                    request.readyState = 4;
                    request.responseText = data;

                    xtag.requestCallback(element, request);

                    delete xtag.callbacks[callbackID];

                    xtag.clearRequest(element);
                };

                request.script = document.createElement('script');
                request.script.type = 'text/javascript';

                request.script.src = options.url = options.url +
                    (~options.url.indexOf('?') ? '&' : '?') +
                    callbackKey +
                    callbackID;

                request.script.onerror = function(error) {
                    element.setAttribute(
                        'data-readystate',
                        request.readyState = 4
                    );

                    element.setAttribute(
                        'data-requeststatus',
                        request.status = 400
                    );

                    xtag.fireEvent(element, 'error', error);
                };

                head.appendChild(request.script);
            }

            element.xtag.request = request;
        },

        requestCallback: function(element, request) {
            if (request !== element.xtag.request) {
                return xtag;
            }

            element.setAttribute('data-readystate', request.readyState);
            element.setAttribute('data-requeststatus', request.status);

            xtag.fireEvent(element, 'dataready', { request: request });

            if (element.dataready) {
                element.dataready.call(element, request);
            }
        },

        clearRequest: function(element) {
            var request = element.xtag.request;

            if (!request) {
                return xtag;
            }

            if (request.script &&
            ~xtag.toArray(head.children).indexOf(request.script)) {
                head.removeChild(request.script);
            }
            else if (request.abort) {
                request.abort();
            }
        },

        addEvent: function(element, type, fn, map) {
            var eventKey = type.split(':')[0];
            var eventMap = (map || xtag.eventMap || {})[eventKey] || [eventKey];

            eventMap.forEach(function(name) {
                element.addEventListener(name, function(event) {
                    xtag.applyPseudos(element, type, fn, [event, element]);
                }, !!~['focus', 'blur'].indexOf(name));
            });
        },

        addEvents: function(element, events, map) {
            var z;

            for (z in events) {
                xtag.addEvent(element, z, events[z], map);
            }
        },

        fireEvent: function(element, type, data) {
            var event = document.createEvent('Event');

            event.initEvent(type, true, true);

            element.dispatchEvent(xtag.merge(event, data));
        }
    };

    var styles = document.createElement('style'),
        nodeInserted = function(event) {
            if (event.animationName === 'nodeInserted' &&
            xtag.tagCheck(event.target)) {
                xtag.extendElement(event.target);
                xtag.getOptions(event.target).onInsert.call(event.target);
            }
        };

        styles.type = "text/css";

    if (prefix.keyframes) {
        var duration = 'animation-duration: 0.0001s;';
        var name = 'animation-name: nodeInserted !important;';

        prefix.properties = '{' + duration +
            name +
            prefix.css +
            duration +
            prefix.css +
            name +
            '}';

        xtag.eventMap.animationstart.forEach(function(event){
            document.addEventListener(event, nodeInserted, false);
        });

        styles.appendChild(
            document.createTextNode(
                '@' + (prefix.keyframes ? prefix.css : '') +
                    'keyframes nodeInserted {' +
                    'from { clip: rect(1px, auto, auto, auto); } ' +
                    'to { clip: rect(0px, auto, auto, auto); }' +
                    '}'
            )
        );
    } else {
        document.addEventListener('DOMContentLoaded', function(event) {
            xtag.domready = true;

            if (xtag.tagList[0]) {
                xtag.query(document, xtag.tagList).forEach(function(element) {
                    nodeInserted(
                        { target: element, animationName: 'nodeInserted' }
                    );
                });
            }
        }, false);

        document.addEventListener('DOMNodeInserted', function(event) {
            event.animationName = 'nodeInserted';

            nodeInserted(event);
        }, false);
    }

    head.appendChild(styles);
    xtag.sheet = styles.sheet;

    var createElement = document.createElement;

    document.createElement = function(tag) {
        var element = createElement.call(this, tag);

        if (xtag.tagCheck(element)) {
            xtag.extendElement(element);
        }

        return element;
    };
})();
