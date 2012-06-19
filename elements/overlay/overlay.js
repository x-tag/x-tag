(function(){

	var oldiOS = /OS [1-4]_\d like Mac OS X/i.test(navigator.userAgent),
		oldDroid = /Android 2\.[0-2].+AppleWebKit/.test(navigator.userAgent),
		gingerbread = /Android 2\.3.+AppleWebKit/.test(navigator.userAgent);

	if(oldDroid || gingerbread){
		var meta = document.createElement('meta');
		meta.name = 'viewport';
		meta.content = 'width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;';
		document.head.appendChild(meta);
	}
	
	if (oldiOS || oldDroid) {
		window.addEventListener('scroll', function(event){
			var overlays = xtag.query(document, 'body > x-overlay');
			overlays.forEach(function(m){
				m.style.top = (window.pageYOffset) + 'px';	
			});
		});
	}

	var closeOverlay = function(e){	
		if (this.getAttribute('data-click-remove') == 'true'){
			this.parentElement.removeChild(this);
			xtag.fireEvent(this, 'overlayclosed');
		}
	}

	xtag.register('x-overlay', {
		events:{			
			'tap': closeOverlay,
		},
		onInsert: function(){
			if (oldiOS || oldDroid){
				this.style.top = (window.pageYOffset) + 'px';
			}
		},
	});

})();
