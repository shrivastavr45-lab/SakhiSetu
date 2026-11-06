# Government Scheme Dataset

## Source

- **Repository:** https://github.com/Aryan-Pardeshi/gov-myscheme-dataset
- **Original data source:** Indian Government MyScheme Portal (https://www.myscheme.gov.in/) via the shrijayan/gov_myscheme Hugging Face repository
- **License:** Apache-2.0 (stated in the repository README; no standalone LICENSE file found at the repository root)
- **Attribution:** Data extracted from the publicly accessible myScheme portal sitemap by the community. This is not an official government release.

## Files

| File | Description | Size |
|---|---|---|
| `gov_myscheme_data.csv` | 2,066 schemes with 16 columns | ~15 MB |
| `analyze.mjs` | Node.js data quality analysis script | ~4 KB |
| `DATA_QUALITY_REPORT.md` | Full data quality assessment | ~4 KB |

## Important notes

- This dataset is a **community extraction**, not an official government release.
- The data was extracted from the myScheme portal sitemap. It may be outdated or contain errors.
- **Do not represent imported schemes as officially verified.** Every imported scheme must be admin-reviewed before publishing.
- The Apache-2.0 license permits commercial and non-commercial use with attribution.
- The CSV file (~15 MB) is excluded from git via `.gitignore`. Download it separately from the source repository when needed.

## How to download

```bash
cd data/scheme-dataset
curl -sL "https://raw.githubusercontent.com/Aryan-Pardeshi/gov-myscheme-dataset/main/gov_myscheme_data.csv" -o gov_myscheme_data.csv
```

## How to analyze

```bash
node data/scheme-dataset/analyze.mjs
```
