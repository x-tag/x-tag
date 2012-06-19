(function(){

var getNavPositions = function(data){
		return { 'first': 1, 'prev': data.current_page - 1, 'next': data.current_page + 1, 'last': data.pages };
	},
	getAttributes = function(elem){
		return { 
			current_page: Number(elem.getAttribute('data-current-page')),
			current_offset: Number(elem.getAttribute('data-current-offset')),
			page_size: Number(elem.getAttribute('data-page-size')),
			pages: Number(elem.getAttribute('data-pages')),
			padding: Number(elem.getAttribute('data-page-padding')||-1),
			prevnext: !!elem.getAttribute('data-prevnext'),
			firstlast: !!elem.getAttribute('data-firstlast')
		}
	};

xtag.register('x-pager', {
	content: '<a data-pager-element="first">first</a>' +
				'<a data-pager-element="prev">previous</a>' +			
				'<a data-pager-element="next">next</a>' +
				'<a data-pager-element="last">last</a>',
	setters:{
		'data-current-page': function(value){
			this.setAttribute('data-current-page', value);
			xtag.tags['x-pager'].onInsert.call(this);
		}
	},
	events: {
		'tap:delegate(a)': function(e){
			var data = getAttributes(this.parentElement);

			if (!data.current_page && data.current_offset && data.page_size){              
				data.current_page = data.current_offset / data.page_size;
			}

			var pos = getNavPositions(data);
			for (var z in pos){
				if (this.getAttribute('data-pager-element') == z) var isNum = data.current_page = pos[z];
			}				
			if (!isNum) data.current_page = Number(this.innerHTML) ;            
			this.parentElement['data-current-page'] = data.current_page;		
		}
	},
	onInsert: function(){           
		var self = this,
			data = getAttributes(this),
			populated = this.children.length > 4;

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
			if (selected) elem.setAttribute('selected', true);
			return elem;
		}
		
		var pos = getNavPositions(data);
		xtag.query(this, '[data-pager-element]').forEach(function(element){
			element.href = getUrl(pos[element.getAttribute('data-pager-element')]);
		});
		
		data.padding = data.padding == -1 ? data.pages : data.padding;
		var startIdx = data.current_page-data.padding < 1 ? 
			1 : 
				data.current_page + data.padding > data.pages ? 
				data.pages - (data.padding*2) : 
				data.current_page-data.padding;

		var endIdx = data.current_page+data.padding > data.pages ? 
			data.pages : 
				data.current_page-data.padding < 1 ? 
				(data.padding * 2) + 1 :
				data.current_page+data.padding;

		for (var i = startIdx; i <= endIdx; i++){
			if(populated){
				var page = this.children[i+2-startIdx];
				page.setAttribute('href', getUrl(i));
				page.setAttribute('selected', data.current_page == i);
				page.innerHTML = i;
			}else{
				var item = createPageItem(i, data.current_page == i);
				this.insertBefore(item, this.children[this.children.length-2]);
			}
		}

		this.setAttribute('data-hidefirst', data.firstlast && data.current_page == 1);
		this.setAttribute('data-hidelast', data.firstlast && data.current_page == data.pages);
		this.setAttribute('data-hideprev', data.prevnext && data.current_page == 1);
		this.setAttribute('data-hidenext', data.prevnext && data.current_page == data.pages);

	}
});

})();