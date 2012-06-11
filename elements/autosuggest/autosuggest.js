
(function(){
	
	var printValue = function(event, element){
		if (this.parentNode == element.lastElementChild){
			element.firstElementChild.value = this.textContent;
			element.firstElementChild.nextSibling.value = JSON.stringify(this.xtag.data);
		}
	}
	
	xtag.register('autosuggest', {
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
				this.firstElementChild.nextSibling.name = name;
				this.setAttribute('name', name);
			}
		},
		events: {
			'dataready:preventable': function(event){				
				this.xtag.clearSuggestions();
				this.xtag.showSuggestions();
			},
			'keyup:delegate(input):keystop(9, 13, 16, 17, 32, 91)': function(event, element){
				var url = element.getAttribute('data-url'),
					padding = element.getAttribute('data-padding') || 1;
				if (url && this.value.length >= padding) element.src = url;
			},
			'keyup:delegate(li):keypass(13)': printValue,
			'click:delegate(li)': printValue,
			'focus': function(event){
				this.xtag.showSuggestions();
			},
			'blur': function(event){
				var element = this;
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