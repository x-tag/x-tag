
(function(){

	xtag.register('x-actionbar', {
		events: {
			'command:delegate(x-action)': function(e){
				var group = this.getAttribute('group'),
					actions = group ? xtag.query(this.parentNode, '[for="' + group + '"]') : false,
					modal = document.querySelector('[data-action-group-modal="' + group + '"]'),
					command = this.getAttribute('command'),
					node = (document.getElementById(this.getAttribute('data-modal-target')) || document.body);

				if (actions && !modal){			
					var overlay = document.createElement('x-overlay');
					overlay.setAttribute('data-click-remove', true);
					node.appendChild(overlay);

					modal = document.createElement('x-modal');
					modal.setAttribute('data-overlay', true);
					modal.setAttribute('data-action-group-modal', group);
					xtag.addEvents(overlay,{
						'command:delegate(x-action)': function(e){
							var cmd = this.getAttribute('command');
							actions.forEach(function(action){
								if(action.getAttribute('command') == cmd){
									xtag.fireEvent(action, 'command', { command: cmd });
								}
							});
							e.stopImmediatePropagation();
						},
						'modalhide': function(){
							node.removeChild(overlay);
						}
					});
					actions.forEach(function(action){
						modal.appendChild(action.cloneNode(false));
					});
					overlay.appendChild(modal);
				} 
				else if (modal) {
					node.removeChild(modal.parentNode);					
				}			
			}
		}
	});
	
	
	
	var onCommand = function(e){
		xtag.fireEvent(this, 'command', { command: this.getAttribute('command') });
	}

	xtag.register('x-action', {
		content: '<img /><label></label>',
		onCreate: function(){
			this.setAttribute('tabindex', 0);
			this.label = this.getAttribute('label');
			this.src = this.getAttribute('src');
		},
		events: {
			'tap': onCommand,
			'keyup:keypass(13)': onCommand,
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