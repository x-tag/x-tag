
(function(){

	var transform = xtag.prefix.js + 'Transform',
		getState = function(el){
			var style = el.firstElementChild.style[transform];
			return [!!style ? Number(style.match(/\((-?\d+)%\)/)[1]) : 0, 100 / el.firstElementChild.children.length];
		},
		slide = function(el, amount){
			el.firstElementChild.style[transform] = 'translate'+ (el.getAttribute('data-orientation') || 'X') + '(' + amount + '%)';
		},
		init = function(){
			var slides = this.firstElementChild,
				size = 100 / slides.children.length,
				orient = this.getAttribute('data-orientation') || 'X',
				style = orient == 'X' ? ['width', 'height'] : ['height', 'width'];
			
			slides.style[xtag.prefix.js + 'Transition'] = 'none';
			slides.style[style[1]] =  '100%';
			slides.style[style[0]] = slides.children.length * 100 + '%';
			slides.style[transform] = 'translate' + orient + '(0%)';
			xtag.toArray(slides.children).forEach(function(slide){				
				slide.style[style[0]] = size + '%';
				slide.style[style[1]] = '100%';
			});
			setTimeout(function(){
				slides.style[xtag.prefix.js + 'Transition'] = '';
			}, 1);
		};

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
				var shift = getState(this);
				slide(this, (shift[0] == -100 + shift[1]) ? 0 : shift[0] - shift[1]);
			},
			slidePrevious: function(){
				var shift = getState(this);
				slide(this, shift[0] == 0 ? -100 + shift[1] : shift[0] + shift[1]);
			}
		}
	});

})();