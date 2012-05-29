
(function(){
	
	xtag.register('panel', {
		mixins: ['request'],
		setters: {
			src: function(src){
				this.setAttribute('src', src);
				if (this.getAttribute('selected')) xtag.request(this, { url: src, method: 'GET' });
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