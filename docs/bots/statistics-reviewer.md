# Statistics Reviewer Bot

The Statistics Reviewer Bot helps maintain statistical rigor by analyzing statistical methods, validating analyses, and ensuring proper reporting of statistical results in manuscripts.

## Overview

This bot provides automated statistical review to support the peer review process, helping identify potential issues with statistical methodology, analysis, and reporting before human review.

**Bot ID**: `statistics-reviewer`  
**Version**: `1.0.0`  
**Author**: Colloquium Team  
**Status**: Seeded (available but not yet implemented)

## Planned Actions

### 1. Review Statistics (`review_statistics`)

Analyzes statistical methods and results in a manuscript.

#### Input Parameters

```json
{
  "manuscriptId": "string (required)",
  "sections": "array (optional, defaults to ['methods', 'results'])",
  "checkMethods": "array (optional, statistical methods to validate)",
  "requireEffectSizes": "boolean (optional, defaults to true)",
  "requireConfidenceIntervals": "boolean (optional, defaults to true)"
}
```

#### Example Usage

**Via Conversation:**
```
@Statistics Reviewer check the statistical analysis in manuscript ms-123
```

**Via API:**
```bash
curl -X POST http://localhost:4000/api/bots/statistics-reviewer/execute/review_statistics \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your-jwt-token" \
  -d '{
    "input": {
      "manuscriptId": "cm287example123",
      "sections": ["methods", "results", "discussion"],
      "requireEffectSizes": true,
      "requireConfidenceIntervals": true
    }
  }'
```

#### Expected Response

```json
{
  "message": "Statistical review completed",
  "result": {
    "reviewId": "stats-review-12345",
    "manuscriptId": "cm287example123",
    "overallScore": 8.5,
    "status": "GOOD",
    "findings": [
      {
        "category": "sample_size",
        "severity": "INFO",
        "message": "Sample size calculation reported (n=120, power=0.8)",
        "location": "Methods, paragraph 3",
        "recommendation": "Good practice"
      },
      {
        "category": "effect_size",
        "severity": "WARNING", 
        "message": "Effect sizes not reported for t-tests",
        "location": "Results, Table 2",
        "recommendation": "Report Cohen's d or similar effect size measure"
      }
    ],
    "methodsDetected": ["t-test", "anova", "regression"],
    "missingElements": ["effect_sizes"],
    "recommendations": [
      "Include effect size measures for all significance tests",
      "Consider reporting confidence intervals for key estimates"
    ],
    "reviewDate": "2024-01-15T14:30:00.000Z"
  },
  "botMessage": "Statistical review completed. Score: 8.5/10. Found 1 warning regarding missing effect sizes. See detailed report for recommendations."
}
```

### 2. Check Power Analysis (`check_power_analysis`)

Validates sample size justification and power calculations.

#### Input Parameters

```json
{
  "manuscriptId": "string (required)",
  "expectedEffect": "number (optional)",
  "alpha": "number (optional, defaults to 0.05)",
  "power": "number (optional, defaults to 0.8)"
}
```

### 3. Validate Data Presentation (`validate_data_presentation`)

Checks tables, figures, and statistical reporting format.

#### Input Parameters

```json
{
  "manuscriptId": "string (required)",
  "checkTables": "boolean (optional, defaults to true)",
  "checkFigures": "boolean (optional, defaults to true)",
  "requirePValues": "boolean (optional, defaults to true)"
}
```

### 4. Generate Statistics Report (`generate_statistics_report`)

Creates comprehensive statistical review report.

#### Input Parameters

```json
{
  "reviewId": "string (required)",
  "format": "string (optional, 'PDF' or 'HTML', defaults to 'PDF')",
  "includeRecommendations": "boolean (optional, defaults to true)"
}
```

## Configuration Schema

The Statistics Reviewer supports the following configuration:

```json
{
  "type": "object",
  "properties": {
    "checkMethods": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Statistical methods to validate",
      "default": ["anova", "regression", "ttest", "chisquare", "correlation"]
    },
    "requireEffectSizes": {
      "type": "boolean",
      "description": "Require effect size reporting",
      "default": true
    },
    "requireConfidenceIntervals": {
      "type": "boolean",
      "description": "Require confidence interval reporting", 
      "default": true
    },
    "alphaLevel": {
      "type": "number",
      "description": "Default significance level",
      "default": 0.05
    },
    "minimumPowerLevel": {
      "type": "number",
      "description": "Minimum acceptable statistical power",
      "default": 0.8
    },
    "autoTrigger": {
      "type": "boolean",
      "description": "Automatically review statistics on submission",
      "default": false
    }
  }
}
```

### Default Configuration

```json
{
  "checkMethods": ["anova", "regression", "ttest", "chisquare", "correlation"],
  "requireEffectSizes": true,
  "requireConfidenceIntervals": true,
  "alphaLevel": 0.05,
  "minimumPowerLevel": 0.8,
  "autoTrigger": false
}
```

## Statistical Methods Supported

### Descriptive Statistics
- **Mean, Median, Mode**: Central tendency measures
- **Standard Deviation, Variance**: Variability measures  
- **Confidence Intervals**: Precision estimates
- **Effect Sizes**: Practical significance measures

### Inferential Statistics
- **T-tests**: Independent, paired, one-sample
- **ANOVA**: One-way, two-way, repeated measures
- **Regression**: Linear, logistic, multiple
- **Chi-square**: Independence, goodness of fit
- **Correlation**: Pearson, Spearman, partial

### Advanced Methods
- **Mixed Models**: Hierarchical/multilevel analysis
- **Survival Analysis**: Time-to-event data
- **Bayesian Methods**: Prior specification and reporting
- **Non-parametric Tests**: Wilcoxon, Kruskal-Wallis, etc.

## Review Categories

### 1. Methodology Review
- **Study Design**: Appropriate for research questions
- **Sample Size**: Adequate power calculations
- **Randomization**: Proper randomization procedures
- **Control Groups**: Appropriate controls and comparisons

### 2. Analysis Review  
- **Assumptions**: Normality, independence, homoscedasticity
- **Missing Data**: Handling and reporting of missing values
- **Multiple Comparisons**: Appropriate corrections applied
- **Model Selection**: Justified statistical model choices

### 3. Reporting Review
- **Statistical Notation**: Proper statistical symbols and formatting
- **P-values**: Exact values vs. threshold reporting
- **Effect Sizes**: Magnitude and practical significance
- **Confidence Intervals**: Width and interpretation

### 4. Presentation Review
- **Tables**: Clear, complete statistical summaries
- **Figures**: Appropriate visualization of data
- **Text**: Clear statistical reporting in prose
- **Reproducibility**: Sufficient detail for replication

## Severity Levels

| Level | Description | Action Required |
|-------|-------------|-----------------|
| **INFO** | Good practices identified | None - positive feedback |
| **WARNING** | Minor issues or missing elements | Recommend improvements |
| **ERROR** | Statistical errors or major omissions | Require corrections |
| **CRITICAL** | Fundamental flaws in analysis | Major revision needed |

## Permissions

The Statistics Reviewer requires:

| Permission | Description |
|------------|-------------|
| `manuscript.read` | Access manuscript content for analysis |
| `manuscript.attach_report` | Attach statistical review reports |

## User Access Control

### Who Can Execute Actions

| Role | Review Statistics | Check Power | Validate Data | Generate Report |
|------|------------------|-------------|---------------|-----------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ✅ | ✅ | ✅ |
| **Reviewer** | ✅ | ✅ | ✅ | ✅ |
| **Author** | ❌ | ❌ | ❌ | ❌ |

## Review Scoring

### Overall Score Calculation
- **9-10**: Excellent statistical practice
- **7-8**: Good with minor improvements needed
- **5-6**: Adequate but requires attention
- **3-4**: Poor, major improvements required
- **1-2**: Unacceptable, fundamental flaws

### Scoring Factors
1. **Methodology (30%)**: Appropriate methods and design
2. **Analysis (25%)**: Correct statistical procedures
3. **Reporting (25%)**: Complete and accurate reporting
4. **Presentation (20%)**: Clear tables, figures, and text

## Installation & Setup

### Current Status

The Statistics Reviewer is **seeded** in the database but not yet fully implemented:

```json
{
  "id": "statistics-reviewer",
  "name": "Statistics Reviewer",
  "isInstalled": true, 
  "isEnabled": true,
  "actions": 0,
  "permissions": 0
}
```

### Implementation Steps

To complete the implementation:

1. **Statistical Analysis Engine**: Implement text parsing for statistical content
2. **Method Detection**: Pattern recognition for statistical procedures
3. **Validation Rules**: Define checking logic for each statistical method
4. **Report Generation**: Create detailed review reports
5. **Integration**: Connect with statistical software APIs (R, Python, etc.)

### Required Dependencies

```json
{
  "dependencies": {
    "statistical-analysis": "^1.0.0",
    "text-parser": "^2.1.0", 
    "pdf-generator": "^1.5.0",
    "math-expression-parser": "^0.9.0"
  }
}
```

## Usage Examples

### Comprehensive Review

```bash
# Full statistical review
curl -X POST http://localhost:4000/api/bots/statistics-reviewer/execute/review_statistics \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=reviewer-token" \
  -d '{
    "input": {
      "manuscriptId": "ms-123",
      "sections": ["methods", "results"],
      "requireEffectSizes": true,
      "requireConfidenceIntervals": true
    }
  }'
```

### Power Analysis Check

```bash
# Check sample size calculation
curl -X POST http://localhost:4000/api/bots/statistics-reviewer/execute/check_power_analysis \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "manuscriptId": "ms-123",
      "expectedEffect": 0.5,
      "alpha": 0.05,
      "power": 0.8
    }
  }'
```

### Integration with Review Workflow

```typescript
// Example automated review
async function onManuscriptSubmitted(manuscriptId: string) {
  if (statsBot.config.autoTrigger) {
    const review = await BotRegistry.executeAction(
      'statistics-reviewer',
      'review_statistics',
      { manuscriptId },
      { userId: 'system' }
    );
    
    if (review.result.overallScore < 6) {
      await notifyEditorialTeam(manuscriptId, 'Statistical review flagged issues');
    }
  }
}
```

## Common Statistical Issues

### Frequently Detected Problems

1. **Missing Effect Sizes**: Significance without practical importance
2. **P-hacking**: Multiple testing without corrections
3. **Inadequate Sample Size**: Underpowered studies
4. **Assumption Violations**: Inappropriate statistical tests
5. **Missing Data Handling**: Inadequate treatment of missing values
6. **Selective Reporting**: Cherry-picking significant results

### Best Practice Recommendations

1. **Report Effect Sizes**: Always include measures of practical significance
2. **Confidence Intervals**: Provide interval estimates, not just point estimates
3. **Pre-registration**: Register analysis plans before data collection
4. **Full Reporting**: Include all conducted analyses, not just significant ones
5. **Assumption Checking**: Validate statistical test assumptions
6. **Reproducible Analysis**: Provide code and data when possible

## Integration with Statistical Software

### R Integration

```r
# Example R analysis validation
statistical_review <- function(manuscript_data) {
  # Check normality assumptions
  normality_tests <- sapply(manuscript_data$numeric_vars, shapiro.test)
  
  # Validate effect size calculations
  effect_sizes <- check_effect_sizes(manuscript_data$analyses)
  
  # Generate recommendations
  recommendations <- generate_recommendations(normality_tests, effect_sizes)
  
  return(list(
    score = calculate_overall_score(manuscript_data),
    findings = compile_findings(manuscript_data),
    recommendations = recommendations
  ))
}
```

### Python Integration

```python
# Example Python statistical validation
import scipy.stats as stats
import pandas as pd

class StatisticalReviewer:
    def review_manuscript(self, manuscript_data):
        findings = []
        
        # Check for effect size reporting
        if not self.has_effect_sizes(manuscript_data):
            findings.append({
                'category': 'effect_size',
                'severity': 'WARNING',
                'message': 'Effect sizes not reported'
            })
        
        # Validate statistical tests
        for test in manuscript_data['statistical_tests']:
            validation = self.validate_test(test)
            findings.extend(validation)
        
        return {
            'score': self.calculate_score(findings),
            'findings': findings
        }
```

## Future Enhancements

### Advanced Features

1. **Machine Learning Detection**: AI-powered identification of statistical issues
2. **Real-time Feedback**: Live analysis during manuscript writing
3. **Bayesian Analysis Support**: Enhanced support for Bayesian methods
4. **Meta-analysis Tools**: Special handling for systematic reviews
5. **Discipline-specific Rules**: Customized checking for different fields

### Reporting Enhancements

1. **Interactive Reports**: Clickable recommendations with explanations
2. **Educational Content**: Links to statistical learning resources
3. **Comparison Reports**: Before/after revision comparisons
4. **Peer Comparison**: Anonymous benchmarking against similar studies

### Integration Improvements

1. **Statistical Software APIs**: Direct integration with R, SPSS, SAS
2. **Version Control**: Track statistical changes across revisions
3. **Collaboration Tools**: Multi-reviewer statistical assessment
4. **Training Modules**: Built-in statistical education for authors

## Error Handling

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `Text parsing failed` | Complex statistical notation | Simplify or clarify notation |
| `Method not recognized` | Uncommon statistical procedure | Manual review required |
| `Insufficient data` | Limited statistical content | Expand statistical reporting |
| `Analysis timeout` | Complex manuscript processing | Break into smaller sections |

### Troubleshooting

```bash
# Check bot configuration
curl http://localhost:4000/api/bots/statistics-reviewer

# View recent reviews
curl http://localhost:4000/api/bots/statistics-reviewer/executions?limit=10

# Update review settings
curl -X PUT http://localhost:4000/api/bots/statistics-reviewer/configure \
  -d '{"config": {"requireEffectSizes": false}}'
```

## Educational Integration

### Learning Objectives

The Statistics Reviewer serves educational purposes by:

1. **Teaching Best Practices**: Highlighting good statistical practices
2. **Identifying Improvements**: Suggesting areas for statistical learning
3. **Resource Linking**: Connecting to statistical education materials
4. **Skill Development**: Helping authors improve statistical literacy

### Training Resources

Integration with statistical education platforms:
- **Online Courses**: Links to statistical methodology courses
- **Tutorials**: Step-by-step guides for common analyses
- **Calculators**: Online tools for power analysis, effect sizes
- **Guidelines**: Journal-specific statistical reporting guidelines

## Compliance & Standards

### Statistical Guidelines

Adherence to established statistical reporting standards:
- **CONSORT**: Clinical trial reporting
- **STROBE**: Observational study reporting  
- **PRISMA**: Systematic review reporting
- **APA Guidelines**: Psychological research standards
- **ICMJE**: Medical journal standards

### Quality Assurance

- **Validation Studies**: Regular testing against known datasets
- **Expert Review**: Periodic review by statistical experts
- **Continuous Improvement**: Updates based on user feedback
- **Accuracy Monitoring**: Tracking false positive/negative rates