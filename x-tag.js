(function(){

	var styles = document.createElement('style'), rules = { keyframes: '', animation: '' };
	['', '-o-', '-ms-', '-moz-', '-webkit-'].forEach(function(prefix){
		rules.keyframes += '@' + prefix + 'keyframes nodeInserted {  from {clip: rect(1px, auto, auto, auto);} to {clip: rect(0px, auto, auto, auto);} }';
		rules.animation += prefix + 'animation-duration: 0.0001s; ' + prefix + 'animation-name: nodeInserted;';
	});
	styles.type = "text/css";
	styles.innerHTML = rules.keyframes;
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
		prefix: 'x',
		tags: {},
		styles: styles,
		tagOptions: {
			events: {},
			methods: {},
			getters: {}, 
			setters: {},
			template: '',
			onCreate: function(){},
			onInsert: function(){}
		},
		eventPseudos: {
			delegate: function(event, selector){
				return xtag.query(this, selector).filter(function(node){
					return node == event.target || node.contains(event.target);
				})[0] || false;
			}
		},
		toArray: function(obj){
			return Array.prototype.slice.call(obj, 0);
		},
		typeOf: function(obj) {
		  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
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
		tagCheck: function(element){
			return element.tagName.match(new RegExp(xtag.prefix + '-', 'i'));
		},
		getTag: function(element){
			return (element.tagName.split('-')[1] || '').toLowerCase();
		},
		getOptions: function(element){
			return xtag.tags[xtag.getTag(element)] || xtag.tagOptions;
		},
		request: function(element, options){
			var request = new XMLHttpRequest();
				request.parsed = false;
				request.open(options.method , options.url, true);
				request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				request.onreadystatechange = function(){
					if (request.readyState == 4) {
						var callback = options[(request.status == 200) ? 'onSuccess' : (request.status >= 400) ? 'onError' : ''] || function(){};
						callback.call(element, request.responseText);
					}
				}
				
			element.xtag.request = request;
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
		extendElement: function(element){
			if (!element.xtag){
				var options = xtag.getOptions(element);
				element.xtag = {};
				for (var z in options.methods) element.xtag[z] = options.methods[z].bind(element);
				for (var z in options.getters) element.__defineGetter__(z, options.getters[z]);
				for (var z in options.setters) element.__defineSetter__(z, options.setters[z]);
				xtag.addEvents(element, options.events);
				if (options.template) element.innerHTML = options.template;
				options.onCreate.call(element);
			}
		},
		onNodeInserted: function(event){
			if (event.animationName == 'nodeInserted' && xtag.tagCheck(event.target)){
				xtag.extendElement(event.target);
				xtag.getOptions(event.target).onInsert.call(event.target);
			}
		},
		register: function(tag, options){
			styles.sheet.insertRule(xtag.prefix + '-' + tag + '{' + rules.animation + '}', 0);
			xtag.tags[tag] = xtag.merge({}, xtag.tagOptions, options);
		}
	};

	var createElement = document.createElement;
	document.createElement = function(tag){
		var element = createElement.call(this, tag);
		if (xtag.tagCheck(element)) xtag.extendElement(element);
		return element;
	};
	
	['animationstart', 'oAnimationStart', 'MSAnimationStart', 'webkitAnimationStart'].forEach(function(event){
		document.addEventListener(event, xtag.onNodeInserted, false);
	});

})();