
(function(){
	
	xtag.register('modal', {
		mixins: ['request'],
		onCreate: function(){
			this.setAttribute('tabindex',0);
		},
		onInsert: function(){
			this.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
		},
		events: {
			'modalhide:preventable': function(){
				this.setAttribute('data-modal-hidden', true);
			}
		}
	});

	if (!xtag.tags.modal.attachedEvent){
		window.addEventListener('keyup', function(event){
			if(event.keyCode == 27) xtag.query(document, 'x-modal').forEach(function(modal){
				if (!modal.getAttribute('data-modal-hidden')) xtag.fireEvent('modalhide', modal);
			});
		});

		window.addEventListener('scroll', function(event){
			var modals = xtag.query(document, 'body > x-modal');
			modals.forEach(function(m){
				m.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';	
			});
		});
		xtag.tags.modal.attachedEvent = true;
	}

})();