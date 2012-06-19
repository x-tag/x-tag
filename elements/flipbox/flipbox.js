
(function(){

	var changeFlipDirection = function(elem, dir){
		var current = elem.className.match(/x-flip-direction-\w+/);	
		if (current) xtag.removeClass(elem, current[0])				
		xtag.addClass(elem, 'x-flip-direction-' + dir);
	}

	xtag.register('x-flipbox', {
		events:{
			'transitionend': function(e){			
				if (e.target == this) xtag.fireEvent(this, 'flipend');
			}
		},
		setters: {
			'flipDirection': function(value){
				if (xtag.hasClass(this ,'x-card-flipped')){
					xtag.skipTransition(this.firstElementChild, function(){
						changeFlipDirection(this, value);
					}, this);
				}
				else{
					changeFlipDirection(this, value);
				}				
			},
			'flipped': function(value){
				xtag.toggleClass(this, 'x-card-flipped');
			}
		},
		getters:{
			'flipDirection': function() {
				var current = this.className.match(/x-flip-direction-(\w+)/);				
				return current[1];
			}, 
			'flipped': function() {
				return xtag.hasClass(this, 'x-card-flipped');
			}
		},
		onCreate: function(){
			xtag.addClass(this, 'x-flip-direction-right');
		}
	});

})();