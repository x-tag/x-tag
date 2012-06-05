
xtag.register('flipbox', {	
	events:{
		'transitionend': function(e){			
			if (e.target == this) xtag.fireEvent('flipend', this);
		}
	},
	setters: {
		'data-flip-direction': function(value){			
			xtag.skipTransition(this.firstElementChild, function(){
				this.setAttribute('data-flip-direction', value);
			}, this);
		},
	},
});