
(function(){
	
	var transitionend = function(e){
			if (e.target.parentNode == this) {
				e.target.removeAttribute('data-current-slide');
				e.target.setAttribute('data-previous-slide', true);
			}
		},
		slide = function(side){
			
		}
	
	xtag.register('slidebox', {
		events: {
			'transitionend': transitionend,
			'oTransitionEnd': transitionend,
			'MSTransitionEnd': transitionend,
			'webkitTransitionEnd': transitionend
		},
		methods: {
			slideTo: function(index){
				slide.call(this, index);
			},
			slideNext: function(){
				slide.call(this, 'next');
			},
			slidePrevious: function(){
				slide.call(this, 'previous');
			}
		}
	});

})();