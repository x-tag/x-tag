(function(){

var getAttributes = function(elem){
  return { 
    current_page: Number(elem.getAttribute('data-current-page')),
    current_offset: Number(elem.getAttribute('data-current-offset')),
    page_size: Number(elem.getAttribute('data-page-size')),
    pages: Number(elem.getAttribute('data-pages')),
    padding: Number(elem.getAttribute('data-page-padding')||50),
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
              //for dev
              e.preventDefault();              
              var parent = this.parentElement,
                data = getAttributes(parent);
              
              if (!data.current_page && data.current_offset && data.page_size){              
                data.current_page = data.current_offset / data.page_size;
              }

              if(this.classList.contains('prev')){
                data.current_page--;
              }else if(this.classList.contains('next')){
                data.current_page++;
              }else if(this.classList.contains('first')){
                data.current_page = 1;
              }else if(this.classList.contains('last')){
                data.current_page = data.pages;
              }else{                
                data.current_page = Number(this.innerHTML) ;
              }              
              parent['data-current-page'] = data.current_page;
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
              if (!url) {
                return '#';
              }
              if (~url.indexOf('current-page')) {                
                  url = url.replace('{current-page}', itr_page);
              } else if (~url.indexOf('current-offset')) {                
                  url = url.replace('{current-offset}', data.page_size * itr_page);
              }
              return url;
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

            for (var i = Math.max(data.current_page-data.padding,1); 
                  i <= Math.min(data.current_page+data.padding, data.pages);
                  i++){               
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