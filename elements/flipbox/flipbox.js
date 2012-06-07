
xtag.register('flipbox', {
	events:{
		'transitionend': function(e){			
			if (e.target == this) xtag.fireEvent('flipend', this);
		}
	},
	setters: {
		'data-flip-direction': function(value){
			if (this.getAttribute('data-flipped') == "true"){
				xtag.skipTransition(this.firstElementChild, function(){
					this.setAttribute('data-flip-direction', value);
				}, this);
			}
			else{
				this.setAttribute('data-flip-direction', value);
			}
		},
	},
	onCreate: function(){
		this.setAttribute('data-flip-direction', this.getAttribute('data-flip-direction')||'right');
		this.setAttribute('data-flipped', this.getAttribute('data-flipped')||'false');
	}
});