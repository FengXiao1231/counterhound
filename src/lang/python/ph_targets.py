"""List property-testable functions in a Python project (stdlib only). Prints JSON to stdout."""
import ast
import json
import os
import sys

SKIP_DIRS = {
    '.git', '.hg', '.venv', 'venv', 'env', '.env', 'node_modules', 'build', 'dist', 'site-packages',
    'tests', 'test', 'testing', 'docs', 'doc', 'examples', 'example', 'benchmarks', 'bench', '.tox',
    '.nox', '__pycache__', '.proofhound', '.mypy_cache', '.pytest_cache', 'scripts', 'tools', 'migrations',
}
SKIP_FILES = {'setup.py', 'conftest.py', 'noxfile.py', 'fabfile.py', 'manage.py', '__main__.py', 'conf.py'}
IMPURE_NAMES = {
    'open', 'input', 'requests', 'urllib', 'socket', 'subprocess', 'httpx', 'aiohttp', 'sleep', 'system',
    'remove', 'unlink', 'rmtree', 'mkdir', 'makedirs', 'getenv', 'environ', 'now', 'today', 'random',
    'uuid4', 'threading', 'multiprocessing', 'sqlite3', 'boto3', 'connect', 'cursor', 'popen', 'logging',
}


def module_name(root, path):
    rel = os.path.relpath(path, root)
    parts = rel[:-3].split(os.sep)
    if parts and parts[0] in ('src', 'lib', 'python') and len(parts) > 1:
        parts = parts[1:]
    if parts[-1] == '__init__':
        parts = parts[:-1]
    return '.'.join(parts)


def annotation(node):
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:
        return None


def signature(fn):
    a = fn.args
    out = []
    for arg in a.posonlyargs + a.args:
        ann = annotation(arg.annotation)
        out.append(arg.arg + (f': {ann}' if ann else ''))
    if a.vararg:
        out.append('*' + a.vararg.arg)
    for arg in a.kwonlyargs:
        ann = annotation(arg.annotation)
        out.append(arg.arg + (f': {ann}' if ann else ''))
    if a.kwarg:
        out.append('**' + a.kwarg.arg)
    ret = annotation(fn.returns)
    return f"({', '.join(out)})" + (f' -> {ret}' if ret else '')


MUTATING_CALLS = {
    'append', 'extend', 'insert', 'pop', 'remove', 'clear', 'update', 'add', 'discard', 'setdefault',
    'popitem', 'sort', 'reverse', 'appendleft', 'popleft', 'put', 'get_nowait', 'put_nowait',
}


def mutates_self(fn):
    """Does this method assign to, delete from, or call a mutating method on an attribute of self?"""
    if not fn.args.args or fn.args.args[0].arg != 'self':
        return False

    def on_self(node):
        while isinstance(node, (ast.Attribute, ast.Subscript)):
            node = node.value
        return isinstance(node, ast.Name) and node.id == 'self'

    for node in ast.walk(fn):
        if isinstance(node, (ast.Assign, ast.AugAssign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if any(isinstance(t, (ast.Attribute, ast.Subscript)) and on_self(t) for t in targets):
                return True
        elif isinstance(node, ast.Delete):
            if any(isinstance(t, (ast.Attribute, ast.Subscript)) and on_self(t) for t in node.targets):
                return True
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in MUTATING_CALLS and isinstance(node.func.value, (ast.Attribute, ast.Subscript)) and on_self(node.func.value):
                return True
    return False


def referenced_names(fn):
    names = set()
    for node in ast.walk(fn):
        if isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
    return names


def collect(root, path):
    try:
        src = open(path, encoding='utf-8').read()
        tree = ast.parse(src)
    except Exception:
        return []
    mod = module_name(root, path)
    rel = os.path.relpath(path, root).replace(os.sep, '/')
    out = []

    def add(fn, owner=None, cls=None):
        name = fn.name
        if name.startswith('_') and name != '__init__':
            return
        if owner and name == '__init__':
            return
        decorators = [annotation(d) or '' for d in fn.decorator_list]
        if any(d.split('.')[-1] in ('property', 'abstractmethod', 'overload') for d in decorators):
            return
        args = fn.args
        n_args = len(args.posonlyargs + args.args + args.kwonlyargs)
        if owner and args.args and args.args[0].arg in ('self', 'cls'):
            n_args -= 1
        doc = ast.get_docstring(fn) or ''
        loc = (getattr(fn, 'end_lineno', fn.lineno) or fn.lineno) - fn.lineno + 1
        refs = referenced_names(fn)
        impure = sorted(refs & IMPURE_NAMES)
        entry = {
            'file': rel, 'module': mod, 'name': name,
            'qualname': f'{owner}.{name}' if owner else name,
            'owner': owner, 'line': fn.lineno, 'loc': loc,
            'signature': signature(fn), 'nArgs': n_args,
            'doc': doc[:600], 'async': isinstance(fn, ast.AsyncFunctionDef),
            'impure': impure, 'annotated': any(a.annotation is not None for a in args.args) or fn.returns is not None,
            'decorators': decorators,
        }
        if cls:
            entry.update(cls)
            entry['mutates'] = mutates_self(fn) and 'staticmethod' not in decorators and 'classmethod' not in decorators
        out.append(entry)

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            add(node)
        elif isinstance(node, ast.ClassDef) and not node.name.startswith('_'):
            methods = [m for m in node.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]
            public = [m for m in methods if not m.name.startswith('_')]
            init = next((m for m in methods if m.name == '__init__'), None)
            # A class whose public methods change its state is a candidate for model-based
            # (stateful) testing: the hunter gets the whole class, not just its pure methods.
            cls = {
                'ownerDoc': (ast.get_docstring(node) or '')[:400],
                'ownerInit': signature(init) if init else '()',
                'ownerMethods': len(public),
                'ownerMutators': sum(1 for m in public if mutates_self(m)),
                'ownerBases': [annotation(b) or '' for b in node.bases],
            }
            for item in methods:
                add(item, node.name, cls)
    return out


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    only = sys.argv[2:]  # optional list of files/dirs to restrict to
    results = []
    starts = [os.path.join(root, o) for o in only] or [root]
    for start in starts:
        if os.path.isfile(start):
            if start.endswith('.py'):
                results.extend(collect(root, start))
            continue
        for dirpath, dirnames, filenames in os.walk(start):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.') and not d.endswith('.egg-info')]
            for f in filenames:
                if not f.endswith('.py') or f in SKIP_FILES or f.startswith('test_') or f.endswith('_test.py'):
                    continue
                results.extend(collect(root, os.path.join(dirpath, f)))
    json.dump(results, sys.stdout)


if __name__ == '__main__':
    main()
