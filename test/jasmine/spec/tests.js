
describe("x-tag ", function() {

	it('should load x-tag and fire DOMComponentsLoaded', function(){
		var componentsLoaded = false;
		document.addEventListener('DOMComponentsLoaded', function(){
			componentsLoaded = true;
		});
		runs(function(){
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = '../../x-tag.js?d=' + new Date().getTime();
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

		it('should parse new tag as soon as it\'s registered', function(){
			var foo = document.createElement('x-foo2');
			testbox.appendChild(foo);

			expect(foo.xtag).toBeUndefined();

			xtag.register('x-foo2', {});

			expect(foo.xtag).toBeDefined();
		});

		it('should register methods for element', function(){

			xtag.register('x-foo', {
				methods: {
					baz: function(){ }
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			expect(foo.baz).toBeDefined();

		});

		it('should register getters for element', function(){

			xtag.register('x-foo', {
				getters: {
					name: function(){ 
						return this.nodeName;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			expect(foo.name).toEqual('X-FOO');

		});

		it('should register setters for element', function(){

			xtag.register('x-foo', {
				setters: {
					name: function(value){ 
						this.setAttribute('name', value);
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);
			foo.name = 'pizza';

			expect(foo.getAttribute('name')).toEqual('pizza');

		});
	});

	describe('helper methods', function(){
		describe('class', function(){
			var body;

			beforeEach(function(){
				body = document.body;
			});

			afterEach(function(){
				body.removeAttribute('class');
			});

			it('hasClass', function(){
				expect(xtag.hasClass(body, 'foo')).toEqual(false);
				body.setAttribute('class', 'foo');
				expect(xtag.hasClass(body, 'foo')).toEqual(true);
			});

			it('addClass', function(){
				expect(xtag.hasClass(body, 'foo')).toEqual(false);
				xtag.addClass(body,'foo');
				expect(xtag.hasClass(body, 'foo')).toEqual(true);
				xtag.addClass(body,'bar');
				expect(xtag.hasClass(body, 'bar')).toEqual(true);
				expect('foo bar').toEqual(body.getAttribute('class'));
				expect(2).toEqual(body.getAttribute('class').split(' ').length);

				xtag.addClass(body,'biz red');
				expect('foo bar biz red').toEqual(body.getAttribute('class'));
				
				//does not prevent dups
				xtag.addClass(body,'foo red');
				expect('foo bar biz red foo red').toEqual(body.getAttribute('class'));
			});

			it('removeClass', function(){				
				xtag.addClass(body,'foo');
				xtag.addClass(body,'bar');
				xtag.addClass(body,'baz');
				expect('foo bar baz').toEqual(body.getAttribute('class'));
				xtag.removeClass(body,'bar');
				expect('foo baz').toEqual(body.getAttribute('class'));
				xtag.removeClass(body,'foo');
				expect('baz').toEqual(body.getAttribute('class'));
				xtag.removeClass(body,'baz');
				expect('').toEqual(body.getAttribute('class'));
				xtag.removeClass(body,'random');

				body.setAttribute('class','  foo  bar baz   red   ');
				xtag.removeClass(body,'bar');
				expect('foo baz red').toEqual(body.getAttribute('class'));
			});

			it('toggleClass', function(){
				xtag.toggleClass(body, 'foo');
				expect('foo').toEqual(body.getAttribute('class'));
				xtag.toggleClass(body, 'foo');
				expect('').toEqual(body.getAttribute('class'));
			});
		});

		describe('utils', function(){
			it('typeOf', function(){
				expect('object').toEqual(xtag.typeOf({}));
				expect('array').toEqual(xtag.typeOf([]));
				expect('string').toEqual(xtag.typeOf('d'));
				expect('number').toEqual(xtag.typeOf(42));
			});

			it('toArray', function(){
				expect([]).toEqual(xtag.toArray({}));
			});
		});
	});
});
