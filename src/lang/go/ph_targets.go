// ph_targets lists exported functions and methods of a Go module as JSON, for counterhound's ranking.
// Usage: go run ph_targets.go <root> [paths...]
package main

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type target struct {
	File      string   `json:"file"`
	Module    string   `json:"module"`
	PkgDir    string   `json:"pkgDir"`
	PkgName   string   `json:"pkgName"`
	Name      string   `json:"name"`
	Qualname  string   `json:"qualname"`
	Owner     *string  `json:"owner"`
	Line      int      `json:"line"`
	Loc       int      `json:"loc"`
	Signature string   `json:"signature"`
	NArgs     int      `json:"nArgs"`
	Doc       string   `json:"doc"`
	Impure    []string `json:"impure"`
	Annotated bool     `json:"annotated"`
	Async     bool     `json:"async"`
}

var skipDirs = map[string]bool{"vendor": true, "testdata": true, "node_modules": true, "examples": true, "example": true, "cmd": true, "tools": true}
var impureRe = regexp.MustCompile(`\b(os\.|net\.|http\.|time\.Now|time\.Sleep|rand\.|ioutil\.|exec\.|syscall\.|log\.|fmt\.Print|sql\.)`)

func modulePath(dir string) (string, string) {
	for d := dir; ; d = filepath.Dir(d) {
		b, err := os.ReadFile(filepath.Join(d, "go.mod"))
		if err == nil {
			m := regexp.MustCompile(`(?m)^module\s+(\S+)`).FindSubmatch(b)
			if m != nil {
				return string(m[1]), d
			}
		}
		if filepath.Dir(d) == d {
			return "", ""
		}
	}
}

func main() {
	root, _ := filepath.Abs(os.Args[1])
	starts := []string{root}
	if len(os.Args) > 2 {
		starts = nil
		for _, p := range os.Args[2:] {
			starts = append(starts, filepath.Join(root, p))
		}
	}
	out := []target{}
	fset := token.NewFileSet()
	visit := func(path string) {
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return
		}
		src, err := os.ReadFile(path)
		if err != nil || len(src) > 400000 || regexp.MustCompile(`(?m)^// Code generated .* DO NOT EDIT\.$`).Match(src) {
			return
		}
		f, err := parser.ParseFile(fset, path, src, parser.ParseComments)
		if err != nil {
			return
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		pkgDir := filepath.ToSlash(filepath.Dir(rel))
		mod, modDir := modulePath(filepath.Dir(path))
		imp := mod
		if r, err := filepath.Rel(modDir, filepath.Dir(path)); err == nil && r != "." {
			imp = mod + "/" + filepath.ToSlash(r)
		}
		for _, d := range f.Decls {
			fn, ok := d.(*ast.FuncDecl)
			if !ok || !fn.Name.IsExported() || fn.Body == nil {
				continue
			}
			t := target{File: rel, Module: imp, PkgDir: pkgDir, PkgName: f.Name.Name, Name: fn.Name.Name, Qualname: fn.Name.Name, Annotated: true, Impure: []string{}}
			if fn.Recv != nil && len(fn.Recv.List) > 0 {
				typ := fn.Recv.List[0].Type
				if s, ok := typ.(*ast.StarExpr); ok {
					typ = s.X
				}
				if ix, ok := typ.(*ast.IndexExpr); ok {
					typ = ix.X
				}
				if ix, ok := typ.(*ast.IndexListExpr); ok {
					typ = ix.X
				}
				id, ok := typ.(*ast.Ident)
				if !ok || !id.IsExported() {
					continue
				}
				owner := id.Name
				t.Owner = &owner
				t.Qualname = owner + "." + fn.Name.Name
			}
			var sb strings.Builder
			printer.Fprint(&sb, fset, fn.Type)
			t.Signature = strings.TrimPrefix(sb.String(), "func")
			for _, p := range fn.Type.Params.List {
				if len(p.Names) == 0 {
					t.NArgs++
				} else {
					t.NArgs += len(p.Names)
				}
			}
			start, end := fset.Position(fn.Pos()), fset.Position(fn.End())
			t.Line, t.Loc = start.Line, end.Line-start.Line+1
			if fn.Doc != nil {
				t.Doc = fn.Doc.Text()
				if len(t.Doc) > 600 {
					t.Doc = t.Doc[:600]
				}
			}
			body := string(src[fset.Position(fn.Body.Pos()).Offset:fset.Position(fn.Body.End()).Offset])
			seen := map[string]bool{}
			for _, m := range impureRe.FindAllString(body, -1) {
				m = strings.TrimSuffix(m, ".")
				if !seen[m] {
					seen[m] = true
					t.Impure = append(t.Impure, m)
				}
			}
			t.Async = strings.Contains(body, "go func") || strings.Contains(body, "chan ")
			out = append(out, t)
		}
	}
	for _, s := range starts {
		info, err := os.Stat(s)
		if err != nil {
			continue
		}
		if !info.IsDir() {
			visit(s)
			continue
		}
		filepath.WalkDir(s, func(p string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() && p != s && (strings.HasPrefix(d.Name(), ".") || strings.HasPrefix(d.Name(), "_") || skipDirs[d.Name()]) {
				return filepath.SkipDir
			}
			if !d.IsDir() {
				visit(p)
			}
			return nil
		})
	}
	json.NewEncoder(os.Stdout).Encode(out)
}
