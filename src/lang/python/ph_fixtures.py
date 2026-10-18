"""List the test fixtures and factories a Python project already has (stdlib only). Prints JSON."""
import ast
import json
import os
import sys

SKIP_DIRS = {
    '.git', '.hg', '.venv', 'venv', 'env', '.env', 'node_modules', 'build', 'dist', 'site-packages',
    '.tox', '.nox', '__pycache__', '.counterhound', '.mypy_cache', '.pytest_cache', 'docs', 'doc',
}
MAX_DEPTH = 3


def annotation(node):
    try:
        return ast.unparse(node) if node is not None else None
    except Exception:
        return None


def first_line(doc):
    return (doc or '').strip().split('\n')[0][:160]


def decorator_name(d):
    node = d.func if isinstance(d, ast.Call) else d
    return annotation(node) or ''


def fixture_scope(d):
    if isinstance(d, ast.Call):
        for kw in d.keywords:
            if kw.arg == 'scope' and isinstance(kw.value, ast.Constant):
                return kw.value.value
    return 'function'


def collect(root, path, out):
    try:
        tree = ast.parse(open(path, encoding='utf-8').read())
    except Exception:
        return
    rel = os.path.relpath(path, root).replace(os.sep, '/')
    base = os.path.basename(path)
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for d in node.decorator_list:
                name = decorator_name(d)
                if name.split('.')[-1] in ('fixture', 'fixture_async') or name.endswith('.fixture'):
                    args = [a.arg for a in node.args.args if a.arg not in ('self', 'request')]
                    out['fixtures'].append({
                        'name': node.name, 'file': rel, 'line': node.lineno, 'scope': fixture_scope(d),
                        'uses': args, 'returns': annotation(node.returns), 'doc': first_line(ast.get_docstring(node)),
                        'autouse': any(kw.arg == 'autouse' and getattr(kw.value, 'value', False) is True for kw in getattr(d, 'keywords', [])),
                        'async': isinstance(node, ast.AsyncFunctionDef),
                    })
                    break
        elif isinstance(node, ast.ClassDef):
            bases = [annotation(b) or '' for b in node.bases]
            if any(b.split('.')[-1].endswith('Factory') for b in bases) or (base in ('factories.py', 'factory.py') and bases):
                model = None
                for item in node.body:
                    if isinstance(item, ast.ClassDef) and item.name == 'Meta':
                        for a in item.body:
                            if isinstance(a, ast.Assign) and any(getattr(t, 'id', '') == 'model' for t in a.targets):
                                model = annotation(a.value)
                out['factories'].append({'name': node.name, 'file': rel, 'line': node.lineno, 'base': bases[0], 'model': model, 'doc': first_line(ast.get_docstring(node))})


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    out = {'fixtures': [], 'factories': [], 'conftests': []}
    for dirpath, dirnames, filenames in os.walk(root):
        depth = os.path.relpath(dirpath, root).count(os.sep) + (0 if dirpath == root else 1)
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.') and depth < MAX_DEPTH]
        for f in filenames:
            if f == 'conftest.py':
                out['conftests'].append(os.path.relpath(os.path.join(dirpath, f), root).replace(os.sep, '/'))
                collect(root, os.path.join(dirpath, f), out)
            elif f in ('factories.py', 'factory.py', 'fixtures.py'):
                collect(root, os.path.join(dirpath, f), out)
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    main()
