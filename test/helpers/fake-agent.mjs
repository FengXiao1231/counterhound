// A scripted stand-in for a coding agent, used by the end-to-end test.
import fs from 'node:fs';
import path from 'node:path';

const PROPS = `from hypothesis import given, strategies as st
from textkit.lists import chunk


@given(st.lists(st.integers()), st.integers(min_value=1, max_value=5))
def test_chunk_roundtrip(xs, n):
    assert [x for c in chunk(xs, n) for x in c] == xs
`;

const FILES = {
  'test_repro_chunk.py': 'from textkit.lists import chunk\n\n\ndef test_repro_chunk():\n    assert chunk([1, 2, 3], 2) == [[1, 2], [3]]\n',
  'test_repro_chunk_again.py': 'from textkit.lists import chunk\n\n\ndef test_repro_chunk_again():\n    assert chunk([1], 2) == [[1]]\n',
  'test_repro_wrong.py': 'from textkit.lists import chunk\n\n\ndef test_repro_wrong():\n    assert chunk([1, 2], 2) == [[1, 2]]\n',
  'test_repro_typo.py': 'from textkit.lists import chunk\n\n\ndef test_repro_typo():\n    assert chunkk([1], 1) == [[1]]\n',
  'test_repro_flaky.py': 'import random\nfrom textkit.lists import chunk\n\n\ndef test_repro_flaky():\n    assert random.random() < 0.5\n',
  'test_repro_div.py': 'from textkit.numbers import safe_div\n\n\ndef test_repro_div():\n    assert safe_div(1, 0) == 0\n',
};

const finding = (title, repro, extra = {}) => ({
  title, function: 'textkit.lists.chunk', kind: 'wrong-result', property: 'concatenating the chunks gives back the input',
  property_test: 'test_chunk_roundtrip', repro_file: repro, input: 'chunk([1, 2, 3], 2)', expected: '[[1, 2], [3]]',
  actual: '[[1, 2]]', evidence: 'Docstring: the last chunk may be shorter.', ...extra,
});

const CART_PROPS = `from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, invariant, rule

from textkit.cart import Cart


class CartMachine(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.cart = Cart()
        self.model = {}

    @rule(sku=st.sampled_from(["a", "b"]), price=st.integers(0, 100), qty=st.integers(1, 5))
    def add(self, sku, price, qty):
        self.cart.add(sku, price, qty)
        self.model[sku] = (price, self.model.get(sku, (0, 0))[1] + qty)

    @invariant()
    def total_matches_model(self):
        assert self.cart.subtotal() == sum(p * q for p, q in self.model.values())


TestCart = CartMachine.TestCase
`;

const CART_FILES = {
  // a plain sequence of steps, as a shrunk stateful failure is written out
  'test_repro_remove_qty.py': 'from textkit.cart import Cart\n\n\ndef test_repro_remove_qty():\n    c = Cart()\n    c.add("a", 100, qty=3)\n    c.remove("a", 1)\n    assert c.quantity("a") == 2\n',
  // built from the project\'s own fixture in tests/conftest.py (two apples at 100)
  'test_repro_negative_total.py': 'def test_repro_negative_total(cart):\n    cart.apply_discount(150)\n    cart.remove("apple", 2)\n    assert cart.total() >= 0\n',
  // documented KeyError: the reviewer must throw this one out
  'test_repro_remove_missing.py': 'from textkit.cart import Cart\n\n\ndef test_repro_remove_missing():\n    Cart().remove("nope")\n',
};

export default async function fakeAgent({ prompt, cwd }) {
  if (prompt.includes("proofhound's bug hunter")) {
    const rel = prompt.match(/Create files only inside `([^`]+)\/`/)[1];
    const dir = path.join(cwd, rel);
    if (prompt.includes('textkit/cart.py')) {
      if (!prompt.includes('Stateful classes') || !prompt.includes('fixture `cart`')) throw new Error('cart prompt lacks the stateful class or the fixture');
      fs.writeFileSync(path.join(dir, 'test_ph_props.py'), CART_PROPS);
      for (const [name, src] of Object.entries(CART_FILES)) fs.writeFileSync(path.join(dir, name), src);
      const cart = (title, repro, extra) => finding(title, repro, { function: 'textkit.cart.Cart.remove', kind: 'wrong-result', property_test: 'TestCart', evidence: 'Docstring of remove and of the class.', ...extra });
      fs.writeFileSync(path.join(dir, 'findings.json'), JSON.stringify([
        cart('Cart.remove ignores qty and drops the whole line', 'test_repro_remove_qty.py', { property: 'removing qty leaves the rest', input: 'add("a", 100, 3); remove("a", 1)', expected: 'quantity 2', actual: 'quantity 0' }),
        cart('Cart.total goes negative after a discount when lines are removed', 'test_repro_negative_total.py', { function: 'textkit.cart.Cart.total', property: 'total is never negative', input: 'fixture cart; apply_discount(150); remove("apple", 2)', expected: '>= 0', actual: '-150' }),
        cart('Cart.remove raises KeyError for an unknown sku', 'test_repro_remove_missing.py', { kind: 'crash', property: 'never raises', input: 'remove("nope")', expected: 'no error', actual: 'KeyError' }),
      ]));
      return 'tested 1 state machine, reported 3 bugs';
    }
    if (!prompt.includes('textkit/lists.py')) {
      fs.writeFileSync(path.join(dir, 'findings.json'), '[]');
      return 'tested 0 properties, reported 0 bugs';
    }
    fs.writeFileSync(path.join(dir, 'test_ph_props.py'), PROPS);
    for (const [name, src] of Object.entries(FILES)) fs.writeFileSync(path.join(dir, name), src);
    const findings = [
      finding('chunk() drops the final partial chunk', 'test_repro_chunk.py'),
      finding('chunk() drops the final partial chunk (dup)', 'test_repro_chunk_again.py'),
      finding('bogus: passes', 'test_repro_wrong.py'),
      finding('bogus: typo in test', 'test_repro_typo.py'),
      finding('bogus: flaky', 'test_repro_flaky.py'),
      finding('safe_div raises on zero', 'test_repro_div.py', { function: 'textkit.numbers.safe_div', kind: 'crash', property: 'never raises' }),
      finding('bogus: missing file', 'test_repro_nope.py'),
    ];
    fs.writeFileSync(path.join(dir, 'findings.json'), 'Here you go:\n```json\n' + JSON.stringify(findings) + '\n```');
    return 'tested 1 property, reported 7 bugs';
  }
  if (prompt.includes('You are fixing a confirmed bug')) {
    // cwd is the sandbox copy of the project
    const file = path.join(cwd, 'textkit', 'lists.py');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('range(0, len(xs) - size + 1, size)', 'range(0, len(xs), size)'));
    // a log file in the real project that keeps growing while the fix runs must not end up in the patch
    if (process.env.PROOFHOUND_FAKE_TOUCH) fs.appendFileSync(process.env.PROOFHOUND_FAKE_TOUCH, 'still running\n');
    return 'Iterate up to len(xs) so the last partial chunk is kept.';
  }
  if (prompt.includes('skeptical, experienced maintainer')) {
    if (prompt.includes('safe_div') || prompt.includes('remove_missing')) return '{"verdict":"not_a_bug","confidence":0.9,"severity":"low","category":"crash","title":"x","reason":"Documented ValueError.","maintainer_would_fix":false}';
    if (prompt.includes('Cart')) return '{"verdict":"bug","confidence":0.9,"severity":"medium","category":"wrong-result","title":"Cart state bug","reason":"The class docstring promises it.","maintainer_would_fix":true}';
    return '{"verdict":"bug","confidence":0.93,"severity":"medium","category":"wrong-result","title":"chunk() drops the last partial chunk","reason":"The docstring says the last chunk may be shorter.","maintainer_would_fix":true}';
  }
  throw new Error('unexpected prompt');
}
