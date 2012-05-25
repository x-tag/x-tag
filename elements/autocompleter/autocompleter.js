
(function(){
	
	xtag.register('autocompleter', {
		bindRequest: true,
		content: '<input type="text" /><ul></ul>',
		events: {
			'keyup:delegate(input)': function(event, element){	
				var url = element.getAttribute('data-url'),
					padding = element.getAttribute('data-padding');
				if (url && (padding ? this.value.length >= padding : this.value.length > 2)) element.src = url.replace('{query}', this.value);
			}
		}
	});
	
})();