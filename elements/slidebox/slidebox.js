
(function(){

	var transform = xtag.prefix.js + 'Transform',
		getState = function(el){
			var selected = xtag.query(el, 'x-slides > [selected="true"]')[0] || 0;
			return [selected ? xtag.query(el, 'x-slides > *').indexOf(selected) : selected, el.firstElementChild.children.length - 1];
		},
		slide = function(el, index){
			var slides = xtag.toArray(el.firstElementChild.children);
			slides.forEach(function(slide){ slide.removeAttribute('selected'); });
			slides[index].setAttribute('selected', true);
			el.firstElementChild.style[transform] = 'translate'+ (el.getAttribute('data-orientation') || 'X') + '(' + index * (-100 / slides.length) + '%)';
		},
		init = function(){
			var slides = this.firstElementChild;
			if (!slides.children.length) return;
			var	size = 100 / (slides.children.length||1),
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
		events:{
			'transitionend': function(e){
				if (e.target == this) xtag.fireEvent('slideend', this);
			}
		},
		setters: {
			'data-orientation': function(value){
				this.setAttribute('data-orientation', value);
				init.call(this);
			},
		},
		methods: {
			slideTo: function(index){
				slide(this, index);
			},
			slideNext: function(){
				var shift = getState(this);
					shift[0]++;
				slide(this, shift[0] > shift[1] ? 0 : shift[0]);
			},
			slidePrevious: function(){
				var shift = getState(this);
					shift[0]--;
				slide(this, shift[0] < 0 ? shift[1] : shift[0]);
			}
		}
	});

})();