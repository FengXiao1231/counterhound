TITLE: URIBuilder.extend_query_with drops existing parameters that have an empty value
REPO: python-hyper/rfc3986
SEARCH: extend_query_with empty value
BODY:
```python
>>> from rfc3986.builder import URIBuilder
>>> URIBuilder(query="a=").extend_query_with([("b", "c")]).query
'b=c'            # expected 'a=&b=c'
>>> URIBuilder(query="a=").extend_query_with([]).query
''               # expected 'a='
```

`extend_query_with` re-parses the existing query with `urllib.parse.parse_qsl(self.query or "")`, whose default `keep_blank_values=False` silently drops every pair with an empty value, so extending a query can lose parameters that were there before. `a=` and `a` are meaningful to many servers (presence of a flag), and the docstring describes the method as extending the existing query, not filtering it.

Reproduced on 2.0.0 (main 3bd3832). The fix is `parse_qsl(self.query or "", keep_blank_values=True)`. Happy to send a PR with a test if you would take one.
