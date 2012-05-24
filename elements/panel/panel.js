
(function(){
	
	xtag.register('panel', {
		bindRequest: true,
		events: {},
		methods: {
			parser: function(request){
				this.innerHTML = request.responseText;
			}
		}
	});
	
})();