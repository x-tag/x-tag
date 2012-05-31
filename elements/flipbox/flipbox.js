xtag.register('flipbox', {
	events:{
		'transitionend': function(e){			
			if (e.target == this) xtag.fireEvent('flipend', this);
		}
	},
	eventMap:{
		'transitionend': ['transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'webkitTransitionEnd'],		
	},
	onInsert: function(){		
	}

});