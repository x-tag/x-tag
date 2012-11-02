
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

		it('should fire onInsert when tag is added to innerHTML', function(){
			var onInsertFired = false;
			xtag.register('x-foo', {
				onInsert: function(){
					onInsertFired = true;
				}, 
				methods: {
					bar: function(){
						return true;
					}
				}
			});

			testBox.innerHTML = '<x-foo id="foo"></x-foo>';

			waitsFor(function(){
				return onInsertFired;
			}, "new tag onInsertFired should fire", 1000);

			runs(function(){				
				var fooElement = document.getElementById('foo');				
				expect(onInsertFired).toEqual(true);
				expect(fooElement.bar()).toEqual(true);
			});
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

		it('should parse new tag as soon as it is registered', function(){
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

		it('xtag.innerHTML should instantiate x-tags in innerHTML', function(){
			xtag.register('x-foo', {
				setters: {
					name: function(value){ 
						this.setAttribute('name', value);
					}
				}
			});
			xtag.innerHTML(testbox, '<x-foo id="foo"></x-foo>');
			var foo = document.getElementById('foo');
			foo.name = "Bob";
			expect(foo.getAttribute('name')).toEqual('Bob');
		});
		
		it('should only fire onInsert when inserted into the DOM', function(){
			var inserted = false;
			xtag.register('x-foo', {
				onInsert: function(){
					inserted = !inserted;
				}
			});
			var temp = document.createElement('div');
			temp.appendChild(document.createElement('x-foo'));
			expect(inserted).toEqual(false);

			testbox.appendChild(temp);

			waitsFor(function(){
				return inserted;
			}, "new tag onInsert should fire", 1000);
			
			runs(function(){
				expect(inserted).toEqual(true);
			});			
		});

		it("should create a mixin, fire onCreate", function(){
			var onCreateFired = false;
			xtag.mixins.test = {
				onCreate: function(){
					onCreateFired = true;
				}
			}

			xtag.register('x-foo', {
				mixins: ['test']
			});

			var foo = document.createElement('x-foo');
			expect(true).toEqual(onCreateFired);
		});

		it("should create a mixin, fire onInsert", function(){
			var onInsertFired = false;
			xtag.mixins.test = {
				onInsert: function(){
					onInsertFired = true;
				}
			}

			xtag.register('x-foo', {
				mixins: ['test']
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			waitsFor(function(){
				return onInsertFired;
			}, "new tag mixin onInsert should fire", 1000);
			
			runs(function(){
				expect(true).toEqual(onInsertFired);
			});	

			
		});

		it("should allow mixins to create getters", function(){
			xtag.mixins.test = {
				getters: {
					foo: function(){
						return "barr";
					}
				}
			}

			xtag.register('x-foo', {
				mixins: ['test']
			});

			var foo = document.createElement('x-foo');
			expect('barr').toEqual(foo.foo);
		});

		it("should allow mixins to create setters", function(){
			xtag.mixins.test = {
				setters: {
					foo: function(value){
						this.setAttribute('foo', value);
					}
				}
			}

			xtag.register('x-foo', {
				mixins: ['test']
			});

			var foo = document.createElement('x-foo');
			foo.foo = 'barr';

			expect('barr').toEqual(foo.getAttribute('foo'));
		});

		it('delegate event pseudo should pass the custom element as second param', function(){
			
			var delegateElem = null;

			xtag.register('x-foo', {
				onCreate: function(){
					this.innerHTML = '<div></div>';
				},				
				events: {
					'click:delegate(div)': function(e, elem){						
						delegateElem = elem;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			xtag.fireEvent(xtag.query(foo,'div')[0],'click');

			expect(foo).toEqual(delegateElem);
			
		});

		it('delegate event pseudo should catch click from inner element', function(){
			
			var clicked = false;

			xtag.register('x-foo', {
				onCreate: function(){
					this.innerHTML = '<div></div>';
				},				
				events: {
					'click:delegate(div)': function(e, elem){
						clicked = true;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			xtag.fireEvent(xtag.query(foo,'div')[0],'click');

			expect(clicked).toEqual(true);
		});

		it('delegate event pseudo "this" should be the element filtered by pseudo', function(){
			
			var clickThis = null;

			xtag.register('x-foo', {
				onCreate: function(){
					this.innerHTML = '<div></div>';
				},				
				events: {
					'click:delegate(div)': function(e, elem){
						clickThis = this;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			var innerDiv = xtag.query(foo,'div')[0];
			xtag.fireEvent(innerDiv,'click');

			expect(innerDiv).toEqual(clickThis);

		});

		it('delegate event pseudo should support chaining', function(){
			
			var clickThis = null;

			xtag.register('x-foo', {
				onCreate: function(){
					this.innerHTML = '<div><foo><bazz></bazz></foo></div>';
				},				
				events: {
					'click:delegate(div):delegate(bazz)': function(e, elem){
						clickThis = this;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			var innerDiv = xtag.query(foo,'bazz')[0];
			xtag.fireEvent(innerDiv,'click');

			expect(innerDiv).toEqual(clickThis);

		});

		it('x-tag pseudos should allow css pseudos', function(){
			
			var clickThis = null;

			xtag.register('x-foo', {
				onCreate: function(){
					this.innerHTML = '<div><foo><bazz><button></button></bazz></foo></div>';
				},				
				events: {
					'click:delegate(div):delegate(bazz:first-child)': function(e, elem){
						clickThis = this;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			var button = xtag.query(foo,'button')[0];
			xtag.fireEvent(button,'click');

			expect(button).toEqual(clickThis.childNodes[0]);

		});


		it('custom event pseudo should fire', function(){
		
			var pseudoFired = false, 
				clickThis = null;

			xtag.pseudos.blah = {
				listener: function(pseudo, fn, args){
					pseudoFired = true;
					args[0].foo = this;
					fn.apply(this, args);
				}
			}

			xtag.register('x-foo', {
				onCreate: function(){
					this.innerHTML = '<div><foo><bazz></bazz></foo></div>';
				},				
				events: {
					'click:delegate(div):blah:delegate(bazz)': function(e, elem){
						clickThis = this;
					}
				}
			});

			var foo = document.createElement('x-foo');
			testbox.appendChild(foo);

			var innerDiv = xtag.query(foo,'bazz')[0];
			xtag.fireEvent(innerDiv,'click');

			expect(pseudoFired).toEqual(true);

			expect(innerDiv).toEqual(clickThis);

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

				xtag.addClass(body,'bar');
				expect('foo baz bar').toEqual(body.getAttribute('class'));
				
				xtag.removeClass(body,'foo');
				expect('baz bar').toEqual(body.getAttribute('class'));
				
				xtag.removeClass(body,'baz');
				expect('bar').toEqual(body.getAttribute('class'));
				
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
				
				xtag.addClass(body, 'baz');
				xtag.toggleClass(body, 'baz');
				expect('').toEqual(body.getAttribute('class'));

			});

			it('Random combination of Class tests', function(){
				body.setAttribute('class', 'flex-stack');
				xtag.addClass(body, 'small_desktop');
				expect('flex-stack small_desktop').toEqual(body.getAttribute('class'));

				body.setAttribute('class', 'flex-stack');
				xtag.addClass(body, 'small_desktop');
				xtag.removeClass(body, 'small_desktop');
				expect('flex-stack').toEqual(body.getAttribute('class'));

				body.setAttribute('class', 'small_desktop flex-stack');
				xtag.removeClass(body, 'small_desktop');
				expect('flex-stack').toEqual(body.getAttribute('class'));

				body.setAttribute('class', 'small_desktop flex-stack');
				xtag.removeClass(body, 'small_desktop');
				xtag.removeClass(body, 'large_desktop');
				expect('flex-stack').toEqual(body.getAttribute('class'));
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
