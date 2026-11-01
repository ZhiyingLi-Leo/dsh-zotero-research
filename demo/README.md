# Synthetic demo for screenshots

No production code or real library is touched. All data below is synthetic.

```sh
# 1. read-only mock Zotero API (port 23120)
node demo/mock-zotero.mjs

# 2. seed a temporary DSH_HOME with synthetic analyses/questions/Q&A
DSH_HOME=/tmp/zp-demo-home node demo/seed.mjs

# 3. install the local package into a temporary profile, then point it at the mock
#    (set zoteroBase: http://127.0.0.1:23120 in the installed package's cordis.patch.yml)
DSH_HOME=/tmp/zp-demo-home dsh --profile demo --no-open --port 3986
```

The mock serves paper `DEMO0001`, attachment `DEMOPDF1`, one note and one annotation, a synthetic fulltext and a generated PDF at `/tmp/dsh-zotero-research-demo.pdf`. Capture `reader-overview.png`, `evidence-preview.png` and `research-questions.png` into `docs/images/`.
