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
		},
		onInsert: function(){
			this.style.top = (window.pageYOffset) + 'px';
		},
	});

	if (!xtag.tags.overlay.attachedEvent){

		window.addEventListener('scroll', function(event){
			var overlays = xtag.query(document, 'body > x-overlay');
			overlays.forEach(function(m){
				m.style.top = (window.pageYOffset) + 'px';	
			});
		});
		xtag.tags.overlay.attachedEvent = true;
	}

})();
