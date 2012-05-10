
xtag.register('accordion', {
	events: {
		'click:delegate(x-toggler)': function(event){
			this.xtag.selectToggler();
		}
	},
	methods: {
		getSelectedIndex: function(){
			var togglers = xtag.query(this, 'x-toggler');
			return togglers.indexOf(xtag.query(this, 'x-toggler[selected="true"]')[0]);
		},
		getSelectedToggler: function(){
			return xtag.query(this, 'x-toggler[selected="true"]')[0];
		},
		nextToggler: function(){
			var togglers = xtag.query(this.parentNode, 'x-toggler');
			(togglers[this.xtag.getSelectedIndex() + 1] || togglers[0]).xtag.selectToggler();
		},
		previousToggler: function(){
			var togglers = xtag.query(this.parentNode, 'x-toggler');
			(togglers[this.xtag.getSelectedIndex() - 1] || togglers[togglers.length - 1]).xtag.selectToggler();
		}
	}
});

xtag.register('toggler', {
	methods: {
		selectToggler: function(){
			var toggler = this;
			xtag.query(this.parentNode, 'x-toggler').forEach(function(el){
				el.setAttribute('selected', el == toggler ? true : null);
			});
		}
	}
});