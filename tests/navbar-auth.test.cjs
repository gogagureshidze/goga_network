const assert = require('node:assert/strict');
const test = require('node:test');
const loadTs = require('./helpers/load-ts.cjs');

function harness() {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let auth = {isLoaded:false, isSignedIn:undefined};
  const navigations = [];
  const router = {push:path => navigations.push(path)};
  const react = {
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = {current:initial};
      return hooks[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = {value:initial};
      return [hooks[index].value, value => {hooks[index].value = value;}];
    },
    useMemo:compute => compute(),
    useCallback:callback => callback,
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
        effects.push(() => {
          previous?.cleanup?.();
          hooks[index] = {dependencies, cleanup:callback()};
        });
      }
    },
  };
  const noop = () => null;
  const {default:Navbar} = loadTs('src/components/Navbar.tsx', {
    react,
    'react/jsx-runtime':{jsx:noop, jsxs:noop},
    '../components/ShuffleText':noop,
    '@/actions/searchUsers':{searchUsers:async () => []},
    'next/link':noop,
    'next/image':noop,
    'lucide-react':{},
    '@clerk/nextjs':{
      useAuth:() => auth,
      useUser:() => ({isLoaded:true, user:auth.isSignedIn ? {username:'member-a'} : null}),
    },
    './MobileMenu':noop,
    'next/navigation':{useRouter:() => router},
  }, {setTimeout:() => 1, clearTimeout(){}});
  return {
    navigations,
    render(nextAuth) {
      auth = nextAuth;
      cursor = 0;
      effects = [];
      Navbar({users:[]});
      effects.forEach(effect => effect());
    },
  };
}

test('anonymous sign-in visits stay on their route after Clerk finishes loading', () => {
  const fixture = harness();
  fixture.render({isLoaded:false, isSignedIn:undefined});
  fixture.render({isLoaded:true, isSignedIn:false});
  fixture.render({isLoaded:true, isSignedIn:false});
  assert.deepEqual(fixture.navigations, []);
});

test('an actual sign-out preserves the existing sign-up redirect exactly once', () => {
  const fixture = harness();
  fixture.render({isLoaded:true, isSignedIn:true});
  assert.deepEqual(fixture.navigations, []);
  fixture.render({isLoaded:true, isSignedIn:false});
  fixture.render({isLoaded:true, isSignedIn:false});
  assert.deepEqual(fixture.navigations, ['/sign-up']);
  fixture.render({isLoaded:true, isSignedIn:true});
  fixture.render({isLoaded:true, isSignedIn:false});
  assert.deepEqual(fixture.navigations, ['/sign-up', '/sign-up']);
});

test('transient Clerk loading is not mistaken for sign-out', () => {
  const fixture = harness();
  fixture.render({isLoaded:true, isSignedIn:true});
  fixture.render({isLoaded:false, isSignedIn:false});
  fixture.render({isLoaded:true, isSignedIn:true});
  assert.deepEqual(fixture.navigations, []);
  fixture.render({isLoaded:false, isSignedIn:undefined});
  fixture.render({isLoaded:true, isSignedIn:false});
  assert.deepEqual(fixture.navigations, ['/sign-up']);
});
