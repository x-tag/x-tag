xtag.register('flipbox', {
	events:{
		'transitionend:delegate(x-card)': function(e){
			xtag.fireEvent('flipend', this);
		}
	},
	eventMap:{
		'transitionend': ['transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'webkitTransitionEnd'],		
	},
	onInsert: function(){		
	}

});