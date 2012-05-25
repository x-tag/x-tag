
(function(){
	
	xtag.register('panel', {
		bindRequest: true,
		setters: {
			src: function(src){
				if (src && this.getAttribute('selected')) xtag.request(this, { url: src, method: 'GET' });
				this.setAttribute('src', src);
			},
			selected: function(value){
				var src = this.getAttribute('src');
				if (src) xtag.request(this, { url: src, method: 'GET' });
				this.setAttribute('selected', value);
			}
		},
		events: {},
		methods: {
			parser: function(request){
				this.innerHTML = request.responseText;
			}
		}
	});
	
})();