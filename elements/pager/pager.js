xtag.register('pager', {

/*  -- Template --

  <div class='pager'>    
    <a class='first' href='' />    
    <a class='prev' href='' />
    <a class='page' href='' />
    <a class='page selected' href='' />
    <a class='page' href='' />
    <a class='next' href='' />    
    <a class='last' href='' />
  </div>

*/
          setters:{
            'data-current-page': function(v){
              console.log("page changed",v, this);
              this.setAttribute('data-current-page', v);
              xtag.tags.pager.onInsert.call(this);
            }
          },
          onCreate: function(){

          }, 
          onInsert: function(){
            var self = this;

            var current_page = Number(this.getAttribute('data-current-page')),
              current_offset = Number(this.getAttribute('data-current-offset')),
              page_size = Number(this.getAttribute('data-page-size')),
              pages = Number(this.getAttribute('data-pages')),
              padding = Number(this.getAttribute('data-page-padding')||50),
              prevnext = !!this.getAttribute('data-prevnext'),
              firstlast = !!this.getAttribute('data-firstlast');

            if (!current_page && current_offset && page_size){              
              current_page = current_offset / page_size;
            }

            var getUrl = function(itr_page){
              var url = self.getAttribute('data-url');
              if (!url) {
                return '#';
              }
              if (~url.indexOf('current-page')) {                
                  url = url.replace('{current-page}', itr_page);
              } else if (~url.indexOf('current-offset')) {                
                  url = url.replace('{current-offset}', page_size * itr_page);
              }
              return url;
            }

            var createPageItem = function(page, classes, txt){
              var elem = document.createElement('a');  
              elem.setAttribute('href', getUrl(page));
              elem.innerHTML = txt || page;
              if(classes)
                elem.classList.add(classes);
              return elem;
            }

            this.innerHTML = "<a class='first' href='"+getUrl(1)+"'>first</a><a class='prev' href='"+getUrl(current_page-1)+"'>previous</a><a class='next' href='"+getUrl(current_page+1)+"'>next</a><a class='last' href='"+getUrl(pages)+"'>last</a>";

            for (var i = Math.max(current_page-padding,1); i <= Math.min(current_page+padding, pages); i++){
                var selected = current_page == i ? 'selected' : '';
                var item = createPageItem(i, selected);
                this.insertBefore(item, this.children[this.children.length-2]);                
            }
            
            this.setAttribute('data-hidefirst', firstlast && current_page == 1);
            this.setAttribute('data-hidelast', firstlast && current_page == pages);
            this.setAttribute('data-hideprev', prevnext && current_page == 1);
            this.setAttribute('data-hidenext', prevnext && current_page == pages);

          }
      });
