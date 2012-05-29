
(function(){
	
	xtag.register('autosuggest', {
		//bindRequest: true,
		content: '<input type="text" /><ul></ul>',
		mixins: ['request'],
		getters: {
			value: function(){
				return this.firstElementChild.value;
			}
		},
		events: {
			'keyup:delegate(input)': function(event, element){	
				var url = element.getAttribute('data-url'),
					padding = element.getAttribute('data-padding');
				
				if (url && (padding ? this.value.length >= padding : this.value.length > 2)) element.src = url.replace('{query}', this.value);
			}
		},
		methods: {
			
		}
	});
	
})();