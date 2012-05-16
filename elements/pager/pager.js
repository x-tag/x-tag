(function(){

var getAttributes = function(elem){
	return { 
		current_page: Number(elem.getAttribute('data-current-page')),
		current_offset: Number(elem.getAttribute('data-current-offset')),
		page_size: Number(elem.getAttribute('data-page-size')),
		pages: Number(elem.getAttribute('data-pages')),
		padding: Number(elem.getAttribute('data-page-padding')||-1),
		prevnext: !!elem.getAttribute('data-prevnext'),
		firstlast: !!elem.getAttribute('data-firstlast')
	};
}


xtag.register('pager', {
	setters:{
		'data-current-page': function(v){
			this.setAttribute('data-current-page', v);
			xtag.tags.pager.onInsert.call(this);
		}
	},
	events: {
		'click:delegate(a)': function(e){
			e.preventDefault(); // for dev only       
			var data = getAttributes(this.parentElement);

			if (!data.current_page && data.current_offset && data.page_size){              
				data.current_page = data.current_offset / data.page_size;
			}

			var values = { 'prev': data.current_page - 1, 'next': data.current_page + 1, 'first': 1, 'last': data.pages };
			for (var z in values){
				if (this.classList.contains(z)) var isNum = data.current_page = values[z];
			}				
			if (!isNum) data.current_page = Number(this.innerHTML) ;
            
			this.parentElement['data-current-page'] = data.current_page;
		}
	},          
	onCreate: function(){

	}, 
	onInsert: function(){           
		var self = this,
		data = getAttributes(this);

		if (!data.current_page && data.current_offset && data.page_size){              
			data.current_page = data.current_offset / data.page_size;
		}

		var getUrl = function(itr_page){
			var url = self.getAttribute('data-url');
			return (!url) ? '#' : url.replace('{current-page}', itr_page).replace('{current-offset}', data.page_size * itr_page);
		}

		var createPageItem = function(page, selected, txt){
				var elem = document.createElement('a');  
				elem.setAttribute('href', getUrl(page));
				elem.innerHTML = txt || page;
			if (selected) elem.setAttribute('selected',true);
			return elem;
		}

		this.innerHTML = "<a class='first' href='"+getUrl(1)+
			"'>first</a><a class='prev' href='"+getUrl(data.current_page-1)+
			"'>previous</a><a class='next' href='"+getUrl(data.current_page+1)+
			"'>next</a><a class='last' href='"+getUrl(data.pages)+"'>last</a>";

		data.padding = data.padding == -1 ? data.pages : data.padding;
		var startIdx = data.current_page-data.padding < 1 ? 
			1 : 
				data.current_page + data.padding > data.pages ? 
				data.pages - (data.padding*2) : 
				data.current_page-data.padding;

		var endIdx = data.current_page+data.padding > data.pages ? 
			data.pages : 
				data.current_page-data.padding < 1 ? (data.padding * 2) + 1: 
				data.current_page+data.padding;

		for (var i = startIdx; i <= endIdx; i++){
			var item = createPageItem(i, data.current_page == i);
			this.insertBefore(item, this.children[this.children.length-2]);                
		}

		this.setAttribute('data-hidefirst', 
		data.firstlast && data.current_page == 1);
		this.setAttribute('data-hidelast', 
		data.firstlast && data.current_page == data.pages);
		this.setAttribute('data-hideprev', 
		data.prevnext && data.current_page == 1);
		this.setAttribute('data-hidenext', 
		data.prevnext && data.current_page == data.pages);

	}
});

})();