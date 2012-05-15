
xtag.register('tabbox', {
	events: {
		'click:delegate(x-tab)': function(event){
			this.xtag.selectTab();
		},
		'keydown:delegate(x-tab)': function(event){
			switch(event.keyCode) {
				case 13: this.xtag.selectTab(); break;
				case 37: this.parentNode.xtag.previousTab(); break;
				case 39: this.parentNode.xtag.nextTab(); break;
			}
		}
	}
});

xtag.register('tab', {
	onInsert: function(){
		xtag.query(this.parentNode, 'x-tab').forEach(function(tab, index){
			tab.setAttribute('tabindex', index + 1);
		});
	},
	methods: {
		selectTab: function(){
			this.focus();
			var tabs = xtag.query(this.parentNode, 'x-tab'),
				index = tabs.indexOf(this);
			tabs.forEach(function(el){
				el.setAttribute('selected', el == this ? true : '');
			}, this);
			xtag.query(this.parentNode.nextElementSibling, 'x-panel').forEach(function(el, i, array){
				el.setAttribute('selected', el == array[index] ? true : '');
			});
		}
	}
});

xtag.register('tabs', {
	methods: {
		getSelectedIndex: function(){
			var tabs = xtag.query(this, 'x-tab');
			return tabs.indexOf(xtag.query(this, 'x-tab[selected="true"]')[0]);
		},
		getSelectedTab: function(){
			return xtag.query(this, 'x-tab[selected="true"]')[0];
		},
		nextTab: function(){
			var tab = this.xtag.getSelectedTab();
			(tab.nextElementSibling || tab.parentNode.firstElementChild).xtag.selectTab();
		},
		previousTab: function(){
			var tab = this.xtag.getSelectedTab();
			(tab.previousElementSibling || tab.parentNode.lastElementChild).xtag.selectTab();
		}
	}
});
