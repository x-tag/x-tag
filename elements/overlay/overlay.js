(function(){

	var closeOverlay = function(e){	
		if (this.getAttribute('data-click-remove') == 'true'){
			this.parentElement.removeChild(this);
			xtag.fireEvent('overlayclosed', this);
		}
	}

	xtag.register('overlay', {
		events:{			
			'tap': closeOverlay,
		}
	});

})();
