
describe("x-tag ", function() {

	it('should load x-tag and fire DOMComponentsLoaded', function(){
		var componentsLoaded = false;
		document.addEventListener('DOMComponentsLoaded', function(){
			componentsLoaded = true;
		});
		runs(function(){
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = '../../x-tag.js';
			document.getElementsByTagName('head')[0].appendChild(script);
		});

		waitsFor(function() {
			return componentsLoaded;
		}, "The document should be loaded", 1000);
		
		runs(function() {
			expect(window.xtag).toBeDefined();
		});
	});

	it('should register a new tag', function(){
		xtag.register('x-foo', {});
		expect(xtag.tags['x-foo']).toBeDefined();
	});

	it('should fire onCreate when a new tag is created', function(){
		var onCreateFired = false;
		xtag.register('x-foo', {
			onCreate: function(){
				onCreateFired = true;
			}
		});

		var foo = document.createElement('x-foo');

		waitsFor(function(){
			return onCreateFired;
		}, "new tag onCreate should fire", 1000);

		runs(function(){
			expect(onCreateFired).toEqual(true);
		});
	});

	describe('using testbox', function(){
		var testBox;
		
		beforeEach(function(){
			testBox = document.getElementById('testbox');
		});

		afterEach(function(){
			testBox.innerHTML = "";
		});	

		it('testbox should exist', function(){
			expect(testBox).toBeDefined();
		});

		it('should fire onInsert when injected into the DOM', function(){
			var onInsertFired = false;
			xtag.register('x-foo', {
				onInsert: function(){
					onInsertFired = true;
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);
			waitsFor(function(){
				return onInsertFired;
			}, "new tag onInsert should fire", 1000);

			runs(function(){
				expect(onInsertFired).toEqual(true);
			});
		});
	});
});
