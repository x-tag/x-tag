
(function(){
	
	xtag.register('actionbar', {
		
	});
	
	var actionEvent = function(e){			
			var group = this.getAttribute('group'),
				actions = group ? xtag.query(this.parentNode, '[for="' + group + '"]') : false,
				modal = document.querySelector('[data-action-group-modal="' + group + '"]'),
				command = this.getAttribute('command'),
				node = (document.getElementById(this.getAttribute('data-modal-target')) || document.body);				

			if (actions && !modal){			
				var overlay = document.createElement('x-overlay');
				overlay.id = 'overlay-'+new Date().getTime();
				overlay.setAttribute('data-click-remove', true);
				overlay.addEventListener('overlayclosed', function(){				
					node.removeChild(modal);
				});
				node.appendChild(overlay);

				modal = document.createElement('x-modal');
				modal.setAttribute('data-overlay-id', overlay.id);
				modal.setAttribute('data-overlay', true);
				modal.setAttribute('data-action-group-modal', group);
				xtag.addEvent(modal, 'command:delegate(x-action)', function(e){
					var cmd = this.getAttribute('command');
					actions.forEach(function(action){					
						if(action.getAttribute('command') == cmd){
							modal.parentNode.removeChild(modal);
							node.removeChild(overlay);
							xtag.fireEvent('command', action, { command: cmd });
						}
					});
					e.stopProgation();
				});			
				actions.forEach(function(action){
					modal.appendChild(action.cloneNode(false));
				});
				node.appendChild(modal);

			} else if (modal) {
				node.removeChild(document.getElementById(modal.getAttribute('data-overlay-id')));
				node.removeChild(modal);
			}
			if (command) xtag.fireEvent('command', this, { command: command });
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
			'keyup:keypass(13)': actionEvent,
			'touchend': actionEvent
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