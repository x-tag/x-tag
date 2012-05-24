
(function(){
	
	var transitionend = function(e){
			if (e.target.parentNode == this) {
				e.target.removeAttribute('data-current-slide');
				e.target.setAttribute('data-previous-slide', true);
			}
		},
		slide = function(side){
			var previous = this.querySelector('[data-current-slide="true"]') || this.children[0],
				next = previous[side + 'ElementSibling'] || this.children[side];
			
			if (!next) return this;
			
			var	axis = this.getAttribute('data-slide-axis'),
				sideMap = { previous: ['left', 'up'], next: ['right', 'down'] };
				
			this.setAttribute('data-slide-direction', sideMap[side][(!axis || axis == 'x') ? 0 : 1]);
			previous.removeAttribute('data-current-slide');
			previous.setAttribute('data-previous-slide', true);
			next.setAttribute('data-current-slide', true);
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