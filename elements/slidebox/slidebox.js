
(function(){

	var slideTo = function(amount){
		this.firstElementChild.style[xtag.prefix.js + 'Transform'] = 'translate'+
			(this.getAttribute('data-orientation')||'X')+'('+amount+'%)';
		},
		init = function(){
			var slides = this.firstElementChild;
			for (var i=0; i < slides.children.length; i++){				
				slides.children[i].style[xtag.prefix.js+'Transform'] = 'translate'+
					(this.getAttribute('data-orientation')||'X') + '(' + i*100 +'%)';
			}
			slides.style[xtag.prefix.js+'Transform'] = 'translate' + (this.getAttribute('data-orientation')||'X') + '(0%)';
		}

	xtag.register('slidebox', {
		onInsert: init,
		eventMap:{
			'transitionend': ['transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'webkitTransitionEnd']
		},
		events:{
			'transitionend': function(e){
				if (e.target == this) xtag.fireEvent('slideend', this);
			}
		},
		setters: {
			'data-orientation': function(value){
				this.setAttribute('data-orientation', value);
				init.call(this);
			}
		},
		methods: {
			slideTo: function(index){

			},
			slideNext: function(){
				var transformStyle = this.firstElementChild.style[xtag.prefix.js+'Transform'],
					currentXShift = !!transformStyle ? Number(transformStyle.match(/\((-?\d+)%\)/)[1]) : 0,
					nextShift = currentXShift > ((this.firstElementChild.children.length-1) * -100) ? currentXShift - 100 : 0;
				slideTo.call(this, nextShift);
			},
			slidePrevious: function(){
				var transformStyle = this.firstElementChild.style[xtag.prefix.js+'Transform'],
					currentXShift = !!transformStyle ? Number(transformStyle.match(/\((-?\d+)%\)/)[1]) : 0,
					nextShift = currentXShift == 0 ? (this.firstElementChild.children.length-1) * -100 : currentXShift + 100;
				slideTo.call(this, nextShift);
			}
		}
	});

})();