# @colloquium/reference-bot

A Colloquium bot that validates references and checks DOI availability and correctness for academic manuscripts.

## Features

- **DOI Validation**: Checks all references for proper DOI format
- **DOI Resolution**: Verifies that DOIs actually resolve to real papers
- **Metadata Retrieval**: Fetches paper details from CrossRef API
- **Missing DOI Detection**: Identifies references without DOIs
- **Comprehensive Reports**: Generates detailed analysis with recommendations

## Installation

### Via Colloquium Admin Interface
1. Go to Admin → Bot Management
2. Click "Install Bot"
3. Enter package name: `@colloquium/reference-bot`
4. Click "Install"

### Via npm (for development)
```bash
npm install @colloquium/reference-bot
```

## Usage

Once installed, the bot can be used in any conversation by mentioning it:

### Commands

#### `@reference-bot check-doi`
Analyzes all references in the manuscript for DOI presence and validity.

**Parameters:**
- `detailed` (boolean, default: false) - Include detailed metadata for each resolved DOI
- `timeout` (number, default: 30) - Timeout in seconds for DOI resolution (5-60)

**Examples:**
```
@reference-bot check-doi
@reference-bot check-doi detailed=true
@reference-bot check-doi timeout=45 detailed=true
```

#### `@reference-bot help`
Shows detailed help and usage instructions.

## What it Checks

✅ **DOI Presence** - Identifies which references are missing DOIs  
✅ **DOI Format** - Validates DOI format (10.xxxx/xxxx)  
✅ **DOI Resolution** - Verifies DOIs actually resolve to real papers  
✅ **Metadata Accuracy** - Cross-references with CrossRef database  

## Sample Output

```
🔍 DOI Reference Check

Manuscript ID: manuscript-123
Analysis Settings:
- Detailed metadata: Yes
- Timeout: 30 seconds

📊 Summary:
- Total references: 25
- References with DOI: 20/25 (80%)
- Valid DOI format: 19/20
- Successfully resolving: 18/19

❌ Missing DOIs (5):
1. Thompson, L. A comprehensive review of recent advances...
2. Wilson, K. Statistical methods for biological research...

⚠️ Invalid DOI Format (1):
1. 10.1234/invalid-doi

💡 Recommendations:
- Add DOIs to 5 references without them
- Fix 1 invalid DOI format
```

## Configuration

The bot supports the following configuration options:

```json
{
  "defaultTimeout": 30,
  "includeMissingDoiReferences": true,
  "enableDetailedReports": true
}
```

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

## Requirements

- Node.js >= 18.0.0
- Colloquium >= 0.1.0

## License

MIT License - see LICENSE file for details.

## Support

- [GitHub Issues](https://github.com/colloquium/colloquium/issues)
- [Documentation](https://docs.colloquium.org)
- [Community Discord](https://discord.gg/colloquium)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to the main Colloquium repository.