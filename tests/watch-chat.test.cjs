const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const test = require('node:test');
const loadTs = require('./helpers/load-ts.cjs');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (typeof node !== 'object') return String(node);
  return textContent(node.props?.children);
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}

function harness() {
  const hooks = [];
  let cursor = 0, effects = [], dirty = false, tree, uuid = 0, stateUpdates = 0;
  const socket = new EventEmitter();
  socket.connected = true;
  const history = deferred();
  const histories = [];
  const sends = [];
  const react = {
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = {current:initial};
      return hooks[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = {value:initial};
      return [hooks[index].value, value => {
        const next = typeof value === 'function' ? value(hooks[index].value) : value;
        if (!Object.is(next, hooks[index].value)) {hooks[index].value = next; dirty = true; stateUpdates++;}
      }];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!hooks[index] || dependencies.some((value, i) => !Object.is(value, hooks[index].dependencies[i]))) hooks[index] = {callback, dependencies};
      return hooks[index].callback;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const previous = hooks[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) effects.push(() => {
        previous?.cleanup?.();
        hooks[index] = {dependencies, cleanup:callback()};
      });
    },
  };
  const jsx = (type, props, key) => ({type, props, key});
  const {default:WatchPartyPanel} = loadTs('src/components/communications/WatchPartyPanel.tsx', {
    react,
    'react/jsx-runtime':{jsx, jsxs:jsx, Fragment:'fragment'},
    '@/hooks/useRealtimeSocket':{emitWithAck:(_socket, event, payload) => {
      assert.equal(_socket, socket);
      if (event === 'getMessages') {
        const request = histories.length ? deferred() : history;
        histories.push({...request, payload});
        return request.promise;
      }
      assert.equal(event, 'sendMessage');
      const request = deferred();
      sends.push({...request, payload});
      return request.promise;
    }},
  }, {setInterval:() => 1, clearInterval(){}, window:{addEventListener(){}, removeEventListener(){}}, crypto:{randomUUID:() => `request-${++uuid}`}});
  const props = {party:{id:'party-a', conversationId:1, hostId:'alice', version:1, title:'Test party', playing:false, position:0, serverTime:Date.now(), updatedAt:new Date().toISOString(), participants:['alice']}, socket, userId:'alice', onUpdate(){}};
  const fixture = {
    socket, history, histories, sends,
    render() {
      let passes = 0;
      do {
        dirty = false; cursor = 0; effects = [];
        tree = WatchPartyPanel(props);
        effects.forEach(effect => effect());
        assert.ok(++passes < 20, 'render must settle');
      } while (dirty);
      return tree;
    },
    button(label) {return nodes(tree, node => node.type === 'button' && textContent(node) === label)[0];},
    input() {return nodes(tree, node => node.props?.['aria-label'] === 'Watch party message')[0];},
    text() {return textContent(tree);},
    draft(value) {fixture.input().props.onChange({target:{value}}); fixture.render();},
    submit() {nodes(tree, node => node.type === 'form')[0].props.onSubmit({preventDefault(){}}); fixture.render();},
    async flush() {await new Promise(resolve => setImmediate(resolve)); fixture.render();},
    unmount() {hooks.forEach(hook => hook?.cleanup?.());},
    stateUpdates:() => stateUpdates,
  };
  fixture.render();
  fixture.button('Theater mode').props.onClick(); fixture.render();
  return fixture;
}
const message = (overrides = {}) => ({id:10, conversationId:1, senderId:'alice', text:'Original text', clientMessageId:'request-1', deletedAt:null, ...overrides});

test('theater receives edits/deletions and late history cannot restore deleted text', async () => {
  const fixture = harness();
  fixture.socket.emit('receiveMessage', message()); fixture.render();
  assert.match(fixture.text(), /Original text/);
  fixture.socket.emit('messageUpdated', message({text:'Edited text'})); fixture.render();
  assert.match(fixture.text(), /Edited text/);
  assert.doesNotMatch(fixture.text(), /Original text/);
  fixture.socket.emit('messageUpdated', message({text:null, deletedAt:'2026-11-14T00:00:00Z'})); fixture.render();
  fixture.history.resolve({messages:[message()]}); await fixture.flush();
  assert.match(fixture.text(), /Deleted message/);
  assert.doesNotMatch(fixture.text(), /Original text|Edited text/);
  fixture.socket.emit('messageUpdated', message({conversationId:2, text:'Other conversation'})); fixture.render();
  assert.doesNotMatch(fixture.text(), /Other conversation/);
  fixture.unmount();
  assert.equal(fixture.socket.listenerCount('receiveMessage'), 0);
  assert.equal(fixture.socket.listenerCount('messageUpdated'), 0);
  assert.equal(fixture.socket.listenerCount('connect'), 0);
});

test('reconnect replaces stale history while preserving live edits and messages during refresh', async () => {
  const fixture = harness();
  fixture.history.resolve({messages:[message({id:5, text:'Outside latest page'}), message(), message({id:11, text:'Deleted while offline', clientMessageId:'older'})]});
  await fixture.flush();
  fixture.socket.emit('connect'); fixture.render();
  assert.equal(fixture.histories.length, 2);
  assert.equal(fixture.histories[1].payload.limit, 30);
  assert.match(fixture.text(), /Loading conversation/);
  fixture.socket.emit('messageUpdated', message({text:'Edit during refresh'}));
  fixture.socket.emit('receiveMessage', message({id:13, clientMessageId:'live', text:'Live message'}));
  fixture.histories[1].resolve({messages:[
    message({text:'Edit made offline'}),
    message({id:11, text:null, deletedAt:'2026-11-14T00:00:00Z', clientMessageId:'older'}),
    message({id:12, text:'Missed message', clientMessageId:'missed'}),
  ]});
  await fixture.flush();
  assert.match(fixture.text(), /Edit during refresh/);
  assert.match(fixture.text(), /Deleted message/);
  assert.match(fixture.text(), /Missed message/);
  assert.match(fixture.text(), /Live message/);
  assert.doesNotMatch(fixture.text(), /Original text|Edit made offline|Deleted while offline|Outside latest page|Loading conversation/);
  fixture.unmount();
});

test('failed history shows an actionable error and retry loads the conversation', async () => {
  const fixture = harness();
  assert.match(fixture.text(), /Loading conversation/);
  fixture.history.reject(new Error('Offline')); await fixture.flush();
  assert.match(fixture.text(), /Conversation history could not be loaded/);
  assert.doesNotMatch(fixture.text(), /Loading conversation/);
  fixture.button('Retry chat history').props.onClick(); fixture.render();
  assert.equal(fixture.histories.length, 2);
  assert.match(fixture.text(), /Loading conversation/);
  assert.equal(fixture.button('Retry chat history'), undefined);
  fixture.histories[1].resolve({messages:[message()]}); await fixture.flush();
  assert.match(fixture.text(), /Original text/);
  assert.doesNotMatch(fixture.text(), /Conversation history could not be loaded|Loading conversation/);
  fixture.unmount();
});

test('a superseded history response cannot replace the newer reconnect snapshot', async () => {
  const fixture = harness();
  fixture.socket.emit('connect');
  fixture.histories[1].resolve({messages:[message({text:'Fresh snapshot'})]}); await fixture.flush();
  fixture.history.resolve({messages:[message({text:'Stale snapshot'})]}); await fixture.flush();
  assert.match(fixture.text(), /Fresh snapshot/);
  assert.doesNotMatch(fixture.text(), /Stale snapshot|Loading conversation/);
  fixture.unmount();
});

test('reconnect history confirms a persisted send whose echo and acknowledgement were lost', async () => {
  const fixture = harness();
  fixture.history.resolve({messages:[]}); await fixture.flush();
  fixture.draft('Persisted message'); fixture.submit();
  fixture.draft('Still typing');
  fixture.socket.emit('connect');
  fixture.histories[1].resolve({messages:[message({text:'Persisted message'})]}); await fixture.flush();
  fixture.sends[0].reject(new Error('Lost acknowledgement')); await fixture.flush();
  assert.equal(fixture.text().split('Persisted message').length - 1, 1);
  assert.doesNotMatch(fixture.text(), /Sending…|Not confirmed/);
  assert.equal(fixture.input().props.value, 'Still typing');
  fixture.unmount();
});

test('failed sends retain their ID on retry and never replace a newer draft', async () => {
  const fixture = harness();
  fixture.history.resolve({messages:[]}); await fixture.flush();
  fixture.draft('First message'); fixture.submit();
  assert.equal(fixture.sends.length, 1);
  fixture.draft('Newer draft');
  fixture.sends[0].reject(new Error('Acknowledgement timed out')); await fixture.flush();
  assert.equal(fixture.input().props.value, 'Newer draft');
  assert.match(fixture.text(), /First message.*Not confirmed/);
  const retry = fixture.button('Retry message');
  retry.props.onClick(); retry.props.onClick(); fixture.render();
  assert.equal(fixture.sends.length, 2, 'repeat clicks cannot send while a retry is pending');
  assert.equal(fixture.sends[1].payload.clientMessageId, fixture.sends[0].payload.clientMessageId);
  assert.equal(fixture.sends[1].payload.text, 'First message');
  fixture.sends[1].resolve({message:message({text:'First message'})}); await fixture.flush();
  assert.equal(fixture.input().props.value, 'Newer draft');
  assert.equal(fixture.text().split('First message').length - 1, 1);
  assert.equal(fixture.button('Retry message'), undefined);
  fixture.unmount();
});

test('socket confirmation wins over late acknowledgement failure or stale success', async () => {
  for (const fail of [false, true]) {
    const fixture = harness();
    fixture.history.resolve({messages:[]}); await fixture.flush();
    fixture.draft('Original text'); fixture.submit();
    fixture.socket.emit('receiveMessage', message());
    fixture.socket.emit('messageUpdated', message({text:'Later edit'})); fixture.render();
    if (fail) fixture.sends[0].reject(new Error('Lost acknowledgement'));
    else fixture.sends[0].resolve({message:message()});
    await fixture.flush();
    assert.match(fixture.text(), /Later edit/);
    assert.doesNotMatch(fixture.text(), /Original text|Sending…|Not confirmed/);
    assert.equal(fixture.button('Retry message'), undefined);
    fixture.unmount();
  }
});

test('late send and history callbacks do not update an unmounted party', async () => {
  const fixture = harness();
  fixture.draft('Pending message'); fixture.submit();
  fixture.unmount();
  const before = fixture.stateUpdates();
  fixture.history.resolve({messages:[message()]});
  fixture.sends[0].reject(new Error('Delayed failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.stateUpdates(), before);
});
