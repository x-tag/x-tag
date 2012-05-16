(function(){

	var styles = document.createElement('style'), rules = { keyframes: '', animation: '' };
	['', '-ms-', '-moz-', '-webkit-'].forEach(function(prefix){
		rules.keyframes += '@' + prefix + 'keyframes nodeInserted {  from {clip: rect(1px, auto, auto, auto);} to {clip: rect(0px, auto, auto, auto);} }';
		rules.animation += prefix + 'animation-duration: 0.001s; ' + prefix + 'animation-name: nodeInserted;';
	});
	styles.type = "text/css";
	styles.innerHTML = rules.keyframes;
	document.head.appendChild(styles);

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
			onInsert: function(){}, 
		},
		eventPseudos: {
			delegate: function(event, selector){
				return xtag.query(this, selector).filter(function(node){
					return node == event.target || node.contains(event.target);
				})[0] || false;
			}
		},
		query: function(element, selector){
			return Array.prototype.slice.call(element.querySelectorAll(selector), 0);
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
			['events', 'methods', 'getters', 'setters'].forEach(function(type){
				options[type] = options[type] || {};
				var defaults = xtag.tagOptions[type];
				for (var z in defaults) options[type][z] = options[type][z] || defaults[z];
			});
			options.onCreate =  options.onCreate || function(){};
			options.onInsert =  options.onInsert || function(){};
			xtag.tags[tag] = options;
		}
	};

	var createElement = document.createElement;
	document.__proto__.createElement = function(tag){
		var element = createElement.call(this, tag);
		if (xtag.tagCheck(element)) xtag.extendElement(element);
		return element;
	};

	['animationstart', 'oAnimationStart', 'MSAnimationStart', 'webkitAnimationStart'].forEach(function(event){
		document.addEventListener(event, xtag.onNodeInserted, false);
	});

})();