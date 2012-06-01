
(function(){
	
	xtag.register('actionbar', {
		
	});
	
	var actionEvent = function(){
		xtag.fireEvent('action', this, { command: this.getAttribute('data-command') });
	};
	
	xtag.register('action', {
		content: '<img src=""/><label></label>',
		onCreate: function(){
			this.tabindex = 0;
			this.label = this.getAttribute('label');
			this.src = this.getAttribute('src');
		},
		events: {
			'click': actionEvent,
			'keyup:keycodes(13)': actionEvent
		},
		setters: {
			'src': function(src){
				this.firstElementChild.src = src; 
				this.setAttribute('src', src);
			},
			'label': function(html){
				this.lastElementChild.innerHTML = html; 
				this.setAttribute('label', html);
			}
		}
	});
	
})();