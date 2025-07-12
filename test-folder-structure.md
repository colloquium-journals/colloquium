# Testing New Folder Structure

## Expected Changes

After the update, new file uploads should:

1. **Create manuscript folders**: `uploads/manuscripts/{manuscriptId}/`
2. **Preserve original filenames**: `results-comparison.png` stays as `results-comparison.png`
3. **Handle conflicts**: If `image.png` already exists, save as `image_1.png`

## File Structure Before:
```
uploads/manuscripts/
├── manuscript-1752183133189-531003360.md
├── manuscript-1752183133190-552938384.bib
└── manuscript-1752183133191-123456789.png  # Was results-comparison.png
```

## File Structure After:
```
uploads/manuscripts/907d4818-2d40-49a2-9013-6bd90be027ea/
├── manuscript.md
├── references.bib
└── results-comparison.png  # Preserves original name!
```

## Testing Steps

1. Upload a new manuscript with images
2. Verify folder structure is created correctly
3. Verify image references work in markdown
4. Test the render command with images

## Benefits

✅ **Relative image paths work**: `![](results-comparison.png)` will find the file  
✅ **Organized by manuscript**: Each manuscript gets its own folder  
✅ **Original filenames preserved**: No more UUID confusion  
✅ **Conflict resolution**: Duplicate names get `_1`, `_2` suffixes  