(function(){
	
	var prefix = {
			js: ['', 'O', 'MS', 'Moz', 'WebKit'].filter(function(prefix){
				return window[prefix + 'CSSKeyframesRule'];
			})[0]
		};
		prefix.css = prefix.js ? '-' + prefix.js.toLowerCase() + '-' : prefix.js;
		prefix.properties = '{' + 
			prefix.css + 'animation-duration: 0.0001s;' +
			prefix.css + 'animation-name: nodeInserted;' + 
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
	};
	
	xtag = {
		namespace: 'x',
		tags: {},
		sheet: styles.sheet,
		tagOptions: {
			content: '',
			events: {},
			methods: {},
			getters: {}, 
			setters: {},
			onCreate: function(){},
			onInsert: function(){}
		},
		eventMap: {
			animationstart: ['animationstart', 'oAnimationStart', 'MSAnimationStart', 'webkitAnimationStart']
		},
		eventPseudos: {
			delegate: function(event, selector){
				return xtag.query(this, selector).filter(function(node){
					return node == event.target || node.contains(event.target);
				})[0] || false;
			}
		},
		
		addEvent: function(element, type, fn){
			element.addEventListener(type.split(':')[0], function(event){
				var target = element;
				if (type.match(':')) {
					type.replace(/:(\w*)\(([^\)]*)\)/g, function(match, pseudo, value){
						if (target){
							var returned = xtag.eventPseudos[pseudo].call(element, event, value);
							target = returned === false ? false : returned || element;
						}
					});
					if (target) fn.call(target, event);
				}
				else fn.call(target, event);
			}, false);
		},
		
		addEvents: function(element, events){
			for (var z in events) xtag.addEvent(element, z, events[z]);
		},
		
		attachKeyframe: function(event, selector){
			xtag.sheet.insertRule(selector + prefix.properties, 0);
		},
		
		clone: function(obj) {
			var F = function(){};
			F.prototype = obj;
			return new F();
		},
		
		extendElement: function(element){
			if (!element.xtag){
				var options = xtag.getOptions(element);
				element.xtag = {};
				if (options.bindRequest) xtag.bindRequest(element, options);
				for (var z in options.methods) element.xtag[z] = options.methods[z].bind(element);
				for (var z in options.getters) element.__defineGetter__(z, options.getters[z]);
				for (var z in options.setters) element.__defineSetter__(z, options.setters[z]);
				xtag.addEvents(element, options.events);
				if (options.content) element.innerHTML = options.content;
				options.onCreate.call(element);
			}
		},
		
		fireEvent: function(type, element, data){
			var event = document.createEvent('Event');
			event.initEvent(type, true, true);
			element.dispatchEvent(xtag.merge(event, data));
		},
		
		getTag: function(element){
			return (element.tagName.split('-')[1] || '').toLowerCase();
		},
		
		getOptions: function(element){
			return xtag.tags[xtag.getTag(element)] || xtag.tagOptions;
		},
		
		merge: function(source, k, v){
			if (xtag.typeOf(k) == 'string') return mergeOne(source, k, v);
			for (var i = 1, l = arguments.length; i < l; i++){
				var object = arguments[i];
				for (var key in object) mergeOne(source, key, object[key]);
			}
			return source;
		},
		
		tagCheck: function(element){
			return element.tagName.match(new RegExp(xtag.namespace + '-', 'i'));
		},
		
		toArray: function(obj){
			return Array.prototype.slice.call(obj, 0);
		},
		
		typeOf: function(obj) {
		  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
		},
		
		register: function(tag, options){
			xtag.attachKeyframe('nodeInserted', xtag.namespace + '-' + tag);
			xtag.tags[tag] = xtag.merge({}, xtag.tagOptions, options);
		},
		
		request: function(element, options){
			var request = new XMLHttpRequest();
				request.open(options.method , options.url, true);
				request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				request.onreadystatechange = function(){
					if (request.readyState == 4){
						xtag.fireEvent('dataready', element, { data: request.responseText });
						if (element.parser){
							var content = xtag.toArray(element.parser.call(element, request.responseText)),
								type = typeof content[0] == 'string';
							if (content[0]) content.forEach(function(el){
								type ? element.innerHTML = el : element.appendChild(el);
							});
						}
						else element.xtag.data = request.responseText;
					}
				}
			request.send();
			element.xtag.request = request;
		},
		
		bindRequest: function(element, options){
			var setSrc = options.setters.src || function(){},
				setSelected = options.setters.selected || function(){},
				onInsert = options.onInsert || function(){};
				
			options.setters.src = function(src){
				setSrc.call(this, src);
				if (src && this.getAttribute('selected')) xtag.request(this, { url: src, method: 'GET' });
				this.setAttribute('src', src);
			};
			
			options.setters.selected = function(value){
				setSelected.call(this, value);
				var src = this.getAttribute('src');
				if (src) xtag.request(this, { url: src, method: 'GET' });
				this.setAttribute('selected', value);
			};
			
			options.onInsert = function(){
				onInsert.call(this);
				var src = this.getAttribute('src');
				if (src) this.src = src;
			}
		},
		
		query: function(element, selector){
			return xtag.toArray(element.querySelectorAll(selector));
		},
		
		wrap: function(original, fn){
			return function(){
				var args = xtag.toArray(arguments);
				original.apply(this, args);
				fn.call(this, args);
			}
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
	}
	
	xtag.eventMap.animationstart.forEach(function(event){
		document.addEventListener(event, nodeInserted, false);
	});
	
	// document.addEventListener('dataready', console.log, false);

})();