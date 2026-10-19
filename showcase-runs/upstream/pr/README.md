# Pull requests to send

One folder per project: a `PR.md` with the header lines `TITLE`, `REPO`, `BASE`, `BRANCH`, `SEARCH` and the body after `BODY:`, and a `0001-*.patch` made with `git format-patch` (patch plus regression test, authored by FengXiao). To send one:

```sh
gh repo fork REPO --clone=false            # once per project, under your account
git clone https://github.com/FengXiao1231/<repo> && cd <repo>
git checkout -b BRANCH origin/BASE
git am path/to/0001-*.patch
git push -u origin BRANCH
gh pr create -R REPO --base BASE --head FengXiao1231:BRANCH --title "TITLE" --body-file body.md
```

`jsoup-NOT-FILED/` is kept for the record only: jsoup's CONTRIBUTING.md does not accept code or text produced with AI assistance, so that patch is not submitted.
