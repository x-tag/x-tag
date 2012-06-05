(function(){
 
	var prefix = {
			js: ['', 'O', 'MS', 'Moz', 'WebKit'].filter(function(prefix){
				return window[prefix + 'CSSKeyframesRule'];
			})[0]
		};
		if (prefix.js == 'WebKit') prefix.js = prefix.js.toLowerCase();
		prefix.css = prefix.js ? '-' + prefix.js.toLowerCase() + '-' : prefix.js;
		prefix.properties = '{' + 
			prefix.css + 'animation-duration: 0.0001s;' +
			prefix.css + 'animation-name: nodeInserted !important;' + 
		'}';
		
	var styles = document.createElement('style');
		styles.type = "text/css";
		styles.innerHTML = '@' + prefix.css + 'keyframes nodeInserted {' +
			'from { clip: rect(1px, auto, auto, auto); } to { clip: rect(0px, auto, auto, auto); }' +
		'}';
		document.head.appendChild(styles);
	
	var mergeOne = function(source, key, current){
			switch (xtag.typeOf(current)){
				case 'object':
					if (xtag.typeOf(source[key]) == 'object') xtag.merge(source[key], current);
					else source[key] = xtag.clone(current);
				break;
				case 'array': source[key] = xtag.toArray(current); break;
				default: source[key] = current;
			}
			return source;
		},
		keypseudo = function(fn, value, pseudo){
			return function(event){	
				if (!!~value.match(/(\d+)/g).indexOf(String(event.keyCode)) == (pseudo == 'keypass')) fn.apply(this, xtag.toArray(arguments));
			}
		};
	
	xtag = {
		namespace: 'x',
		prefix: prefix, 
		tags: {},
		callbacks: {},
		sheet: styles.sheet,
		anchor: document.createElement('a'),
		tagOptions: {
			content: '',
			mixins: [],
			events: {},
			methods: {},
			getters: {}, 
			setters: {},
			onCreate: function(){},
			onInsert: function(){},
			eventMap: {
				animationstart: ['animationstart', 'oAnimationStart', 'MSAnimationStart', 'webkitAnimationStart'],
				transitionend: ['transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'webkitTransitionEnd']
			}
		},
		pseudos: {
			delegate: function(fn, value, pseudo, event){
				var target = xtag.query(this, value).filter(function(node){
					return node == event.target || node.contains ? node.contains(event.target) : false;
				})[0];
				
				return target ? function(){
					fn.apply(target, xtag.toArray(arguments));
				} : false;
			},
			keystop: keypseudo,
			keypass: keypseudo,
			retain: function(fn, value, pseudo, property, element){
				value = element[property];
				return function(){
					fn();
					element[property] = value;
				}
			},
			preventable: function(fn, value, pseudo){
				return function(event){
					if (!event.defaultPrevented) fn.apply(this, xtag.toArray(arguments));
				}
			}
		},
		mixins: {
			request: {
				onInsert: function(){
					this.src = this.getAttribute('src');
				},
				getters: {
					'dataready:retain': function(fn){
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
					'dataready:retain': function(fn){
						this.xtag.dataready = fn;
						if (this.xtag.request && this.xtag.request.readyState == 4) fn.call(this, this.xtag.request);
					}
				}
			}
		},
		
		typeOf: function(obj) {
		  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
		},
		
		toArray: function(obj){
			var sliced = Array.prototype.slice.call(obj, 0);
			return sliced.hasOwnProperty ? sliced : [obj];
		},
		
		query: function(element, selector){
			return xtag.toArray(element.querySelectorAll(selector));
		},
		
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
		
		tagCheck: function(element){
			return element.tagName.match(new RegExp(xtag.namespace + '-', 'i'));
		},
		
		getTag: function(element){
			return (element.tagName ? element.tagName.split('-')[1] : '').toLowerCase();
		},
		
		getOptions: function(element){
			return xtag.tags[xtag.getTag(element)] || xtag.tagOptions;
		},
		
		register: function(tag, options){
			xtag.attachKeyframe('nodeInserted', xtag.namespace + '-' + tag);
			xtag.tags[tag] = xtag.merge({}, xtag.tagOptions, xtag.applyMixins(options));
		},
		
		attachKeyframe: function(event, selector){
			xtag.sheet.insertRule(selector + prefix.properties, 0);
		},
		
		extendElement: function(element){
			if (!element.xtag){
				element.xtag = {};
				var options = xtag.getOptions(element);
				for (var z in options.methods) element.xtag[z] = options.methods[z].bind(element);
				for (var z in options.getters) xtag.applyAccessor('get', element, z, options.getters[z]);
				for (var z in options.setters) xtag.applyAccessor('set', element, z, options.setters[z]);
				xtag.addEvents(element, options.events, options.eventMap);
				if (options.content) element.innerHTML = options.content;
				options.onCreate.call(element);
			}
		},
		
		applyMixins: function(options){
			if (options.mixins) options.mixins.forEach(function(name){
				var mixin = xtag.mixins[name];
				for (var z in mixin) {
					switch (xtag.typeOf(mixin[z])){
						case 'function': options[z] = options[z] ? xtag.wrap(options[z], mixin[z]) : mixin[z];
							break;
						case 'object': options[z] = xtag.merge({}, mixin[z], options[z]);
							break;
						default: options[z] = mixin[z];
					}
				}
			});
			return options;
		},
		
		applyAccessor: function(accessor, element, key, value){
			var accessor = accessor[0].toUpperCase();
			xtag.applyPseudos(element, key, function(){
				element['__define' + accessor + 'etter__'](key, value);
			}, [key, element]);
		}, 
		
		applyPseudos: function(element, key, fn, args){
			var	action = fn, args = xtag.toArray(args);
			if (key.match(':')) key.replace(/:(\w*)(?:\(([^\)]*)\))?/g, function(match, pseudo, value){ // TODO: Make this regex find non-paren pseudos --> foo:bar:baz()
				if (action){
					var passed = xtag.toArray(args);
						passed.unshift(action, value, pseudo);
					var returned = xtag.pseudos[pseudo].apply(element, passed);
					action = returned === false ? false : returned || fn;
				}
			});
			if (action) action.apply(element, args);
		},
		
		request: function(element, options){
			xtag.clearRequest(element);
			var last = element.xtag.request || {};
				element.xtag.request = options;
			var request = element.xtag.request,
				callbackKey = element.getAttribute('data-callback-key') || 'callback' + '=xtag.callbacks.';
			if (xtag.fireEvent('beforerequest', element) === false) return false;
			if (last.url && !options.update && last.url.replace(new RegExp('\&?\(' + callbackKey + 'x[0-9]+)'), '') == element.xtag.request.url){
				element.xtag.request = last;
				return false;
			}
			element.setAttribute('src', element.xtag.request.url);
			xtag.anchor.href = options.url;
			if (xtag.anchor.hostname == window.location.hostname) {
				request = xtag.merge(new XMLHttpRequest(), request);
				request.open(request.method , request.url, true);
				request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				request.onreadystatechange = function(){
					element.setAttribute('data-readystate', request.readyState);
					if (request.readyState == 4){
						(request.status < 400) ? xtag.requestCallback(element, request) : xtag.fireEvent('requesterror', element, error);
					}
				}
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
				request.script = document.createElement('script');
				request.script.type = 'text/javascript';
				request.script.src = options.url = options.url + (~options.url.indexOf('?') ? '&' : '?') + callbackKey + callbackID;
				request.script.onerror = function(error){
					element.setAttribute('data-readystate', request.readyState = 4);
					element.setAttribute('data-requeststatus', request.status = 400);
					xtag.fireEvent('requesterror', element, error);
				}
				document.head.appendChild(request.script);
			}
			element.xtag.request = request;
		},
		
		requestCallback: function(element, request){
			if (request != element.xtag.request) return xtag;
			element.setAttribute('data-readystate', request.readyState);
			element.setAttribute('data-requeststatus', request.status);			
			xtag.fireEvent('dataready', element, { request: request });
			if (element.dataready) element.dataready.call(element, request);
		},
		
		clearRequest: function(element){
			var request = element.xtag.request;
			if (!request) return xtag;
			if (request.script && ~xtag.toArray(document.head.children).indexOf(request.script)) {
				document.head.removeChild(request.script);
			}
			else if (request.abort) request.abort();
		},
		
		addEvent: function(element, type, fn, map){
			var eventKey = type.split(':')[0],
				eventMap = (map || xtag.getOptions(element).eventMap || {})[eventKey] || [eventKey];
				
			eventMap.forEach(function(name){
				element.addEventListener(name, function(event){
					xtag.applyPseudos(element, type, fn, [event, element]);
				}, !!~['focus', 'blur'].indexOf(name));
			});
		},
		
		addEvents: function(element, events, map){
			for (var z in events) xtag.addEvent(element, z, events[z], map);
		},
		
		fireEvent: function(type, element, data){
			var event = document.createEvent('Event');
			event.initEvent(type, true, true);
			element.dispatchEvent(xtag.merge(event, data));
		}
	};
	
	var createElement = document.createElement;
	document.createElement = function(tag){
		var element = createElement.call(this, tag);
		if (xtag.tagCheck(element)) xtag.extendElement(element);
		return element;
	};
	
	var nodeInserted = function(event){
			if (event.animationName == 'nodeInserted' && xtag.tagCheck(event.target)){
				xtag.extendElement(event.target);
				xtag.getOptions(event.target).onInsert.call(event.target);
			}
		};
	
	xtag.tagOptions.eventMap.animationstart.forEach(function(event){
		document.addEventListener(event, nodeInserted, false);
	});
	
})();