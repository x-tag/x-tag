xtag.register('overlay', {
	events:{
		'click': function(e){
			if (e.target == this) {
				this.parentElement.removeChild(this);
			}
		}
	},
	onCreate: function(){	
	}
});