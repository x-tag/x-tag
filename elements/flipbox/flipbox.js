
xtag.register('flipbox', {
	eventMap:{
		'transitionend': ['transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'webkitTransitionEnd'],		
	},
	events:{
		'transitionend': function(e){			
			if (e.target == this) xtag.fireEvent('flipend', this);
		}
	}
});