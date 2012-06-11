
(function(){

	var changeFlipDirection = function(elem, dir){
		var m = elem.className.match(/flip-direction-\w+/);	
		if (m){
			xtag.removeClass(elem, m[0])				
		}
		xtag.addClass(elem, 'flip-direction-'+dir);
	}

	xtag.register('flipbox', {
		events:{
			'transitionend': function(e){			
				if (e.target == this) xtag.fireEvent('flipend', this);
			}
		},
		setters: {
			'flipDirection': function(value){
				if (xtag.hasClass(this ,'card-flipped')){
					xtag.skipTransition(this.firstElementChild, function(){
						changeFlipDirection(this, value);
					}, this);
				}
				else{
					changeFlipDirection(this, value);
				}				
			},
			'flipped': function(value){
				xtag.toggleClass(this, 'card-flipped');
			}
		},
		getters:{
			'flipDirection': function() {
				var m = this.className.match(/flip-direction-(\w+)/);				
				return m[1];
			}, 
			'flipped': function() {
				return xtag.hasClass(this, 'card-flipped');
			}
		},
		onCreate: function(){
			xtag.addClass(this, 'flip-direction-right');
		}
	});

})();