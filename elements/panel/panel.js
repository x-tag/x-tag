
(function(){
	
	xtag.register('panel', {
		mixins: ['request'],
		setters: {
			src: function(src){
				if (src && this.getAttribute('selected')) xtag.request(this, { url: src, method: 'GET' });
				this.setAttribute('src', src);
			},
			selected: function(value){
				xtag.request(this, { url: this.getAttribute('src'), method: 'GET' });
				this.setAttribute('selected', value);
			}
		},
		events: {},
		methods: {
			dataready: function(request){
				this.innerHTML = request.responseText;
			}
		}
	});
	
})();