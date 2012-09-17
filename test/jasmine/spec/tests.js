
describe("X-Tag ", function() {
	var iframe = document.createElement('iframe');
	iframe.onload = function(){
		console.log('foo');
	}
	var win;
	var doc;
	var head;
	var body;
	
	beforeEach(function() {
		if (win) {
			win.location = 'about:blank';
		}
		else {
			iframe.src = 'about:blank';
			document.body.appendChild(iframe);
			win = iframe.contentWindow;
			doc = iframe.contentDocument;
			head = doc.getElementsByTagName('head')[0];
			body = doc.body;
			body.innerHTML = "FUUUUUUUUUUUUUUUUUCK!";
		}
		console.log(doc, head, body);
	});

	it("should fire DOMComponentsLoaded", function() {
		var componentsLoaded = false;
		console.log(head);
		doc.addEventListener('DOMComponentsLoaded', function(event){
			componentsLoaded = true;
		});
		
		waitsFor(function() {
			return componentsLoaded;
		}, "The document should be loaded", 2000);
		
		runs(function() {
			console.log('test');
			expect('DOMComponentsLoaded').toEqual('DOMComponentsLoaded');
		});
		
		var script = doc.createElement('script');
			script.type = 'text/javascript';
			script.src = '../../../x-tag.js';
		head.appendChild(script);
	});
	
/* 	describe("when included ", function() {
		
		beforeEach(function() {
			var script = doc.createElement('script');
				script.type = 'text/javascript';
				script.src = '../../../x-tag.js';
			head.appendChild(script);
		});
		
		it("should fire DOMComponentsLoaded", function() {
			expect(true).toEqual(true);
		});
		
	}); */
});