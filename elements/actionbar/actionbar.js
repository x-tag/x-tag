
(function(){
	
	xtag.register('actionbar', {
		
	});
	
	var actionEvent = function(){
		var group = this.getAttribute('group'),
			actions = group ? xtag.query(this.parentNode, '[for="' + group + '"]') : false,
			modal = document.querySelector('[data-action-group-modal="' + group + '"]'),
			command = this.getAttribute('data-command');
		
		if (command) xtag.fireEvent('action', this, { command: command });
		if (actions && !modal){
			modal = document.createElement('x-modal');
			modal.setAttribute('data-overlay', true);
			modal.setAttribute('data-action-group-modal', group);
				
			actions.forEach(function(action){
				var clone = action.cloneNode();
				xtag.addEvents(clone, xtag.tags.action);
				modal.appendChild(clone);
			});
			var modalTarget = this.getAttribute('data-modal-target');
			(document.getElementById(modalTarget) || document.body).appendChild(modal);
		}
		else if (modal) {
			modal.parentNode.removeChild(modal);
		}
	};
	
	xtag.register('action', {
		content: '<img /><label></label>',
		onCreate: function(){
			this.setAttribute('tabindex', 0);
			this.label = this.getAttribute('label');
			this.src = this.getAttribute('src');
		},
		events: {
			'click': actionEvent,
			'keyup:keypass(13)': actionEvent
		},
		setters: {
			'src': function(src){
				this.firstElementChild.src = src; 
				this.setAttribute('src', src);
			},
			'label': function(html){
				this.lastElementChild.innerHTML = html; 
				this.setAttribute('label', html);
			}
		}
	});
	
})();