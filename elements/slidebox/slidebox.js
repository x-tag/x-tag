
(function(){

	var slideTo = function(amount){
		this.style[xtag.prefix.js + 'Transform'] = 'translate'+
			(this.getAttribute('data-orientation')||'X')+'('+amount+'%)';
		},
		init = function(){
			var elemCount = this.children.length;
			for(var i=0; i < this.children.length; i++){				
				this.children[i].style[xtag.prefix.js+'Transform'] = 'translate'+
					(this.getAttribute('data-orientation')||'X') + '(' + i*100 +'%)';
			}
			this.style[xtag.prefix.js+'Transform'] = 'translate' + (this.getAttribute('data-orientation')||'X') + '(0%)';
		}

	xtag.register('slidebox', {
		events:{
			'transitionend': function(e){
				if (e.target == this) xtag.fireEvent('slideend', this);
			}
		},
		eventMap:{
			'transitionend': ['transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'webkitTransitionEnd'],
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
				var transformStyle = this.style[xtag.prefix.js+'Transform'];
				var currentXShift = !!transformStyle ? Number(transformStyle.match(/\((-?\d+)%\)/)[1]) : 0;
				var nextShift = currentXShift > ((this.children.length-1) * -100) ? currentXShift - 100 : 0;
				slideTo.call(this, nextShift);
			},
			slidePrevious: function(){
				var transformStyle = this.style[xtag.prefix.js+'Transform'];
				var currentXShift = !!transformStyle ? Number(transformStyle.match(/\((-?\d+)%\)/)[1]) : 0;
				var nextShift = currentXShift == 0 ? (this.children.length-1) * -100 : currentXShift + 100;
				slideTo.call(this, nextShift);
			}
		},
		onInsert: init

	});

})();