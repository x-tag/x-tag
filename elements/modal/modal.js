
(function(){
	
	xtag.register('modal', {
		mixins: ['request'],
		onCreate: function(){
			this.setAttribute('tabindex',0);
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
		})
		xtag.tags.modal.attachedEvent = true;
	}

})();