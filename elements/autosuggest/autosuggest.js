
(function(){
	
	var printValue = function(event, element){
		if (this.parentNode == element.lastElementChild){
			element.firstElementChild.value = this.textContent;
			element.firstElementChild.nextSibling.value = JSON.stringify(this.xtag.data);
			element.xtag.hideSuggestions();
			element.firstElementChild.focus();
			xtag.fireEvent(element, 'change');
		}
	}
	
	xtag.register('x-autosuggest', {
		content: '<input type="text" /><input type="hidden" /><ul></ul>',
		mixins: ['request'],
		getters: {
			value: function(){
				return this.firstElementChild.value;
			}
		},
		setters: {
			name: function(name){
				this.firstElementChild.name = name;
				this.firstElementChild.nextElementSibling.name = name;
				this.setAttribute('name', name);
			}
		},
		events: {
			'dataready:preventable': function(){				
				this.xtag.clearSuggestions();
				this.xtag.showSuggestions();
			},
			'keydown:keypass(38, 40)': function(event, element){
				event.preventDefault();
				this.xtag.showSuggestions();
				
				var first = element.lastElementChild.firstElementChild;	
				if (!first) return element;
				
				var selected = xtag.query(element, '[selected="true"]')[0];
				if (selected) (event.keyCode - 38 ? selected.nextElementSibling || first : selected.previousElementSibling || element.lastElementChild.lastElementChild).focus()
				else first.focus();
			},
			'keyup:delegate(input):keystop(9, 13, 16, 17, 32, 37, 38, 39, 40, 91)': function(event, element){
				var url = element.getAttribute('data-url'),
					padding = element.getAttribute('data-padding') || 1;
				if (url && this.value.length >= padding) element.src = url;
			},
			'keyup:delegate(li):keypass(13)': printValue,
			'click:delegate(li)': printValue,
			'focus:delegate(li)': function(){
				xtag.query(this.parentNode, '[selected="true"]').forEach(function(li){
					li.removeAttribute('selected');
				});
				this.setAttribute('selected', true);
			},
			'blur': function(event, element){
				setTimeout(function(){
					if (element != document.activeElement && !element.contains(document.activeElement)) element.xtag.hideSuggestions();
				}, 1);
			}
		},
		methods: {
			addSuggestion: function(content, data){
				var li = document.createElement('li');
					li.setAttribute('tabindex', 0);
					li.innerHTML = content;
					li.xtag = { data: data };
				this.lastElementChild.appendChild(li);	
			},
			clearSuggestions: function(){
				this.lastElementChild.innerHTML = '';
			},
			showSuggestions: function(){
				this.lastElementChild.setAttribute('data-show-suggestions', true);
			},
			hideSuggestions: function(){
				this.lastElementChild.removeAttribute('data-show-suggestions');
			}
		}
	});
	
})();