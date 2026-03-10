#!/usr/bin/env python3
import re

# Read the file
with open('components/landing/TrustSafetyShowcase.tsx', 'r') as f:
    content = f.read()

# Replace broken lines within className attributes
# Pattern: className="...\n  ..." -> className="... ..."
content = re.sub(r'(className="[^"]*)\n\s+', r'\1 ', content)

# Replace broken lines within template literals and expressions
content = re.sub(r'(\{[^\}]*)\n\s+', r'\1 ', content)

# Replace remaining orphaned line breaks that are inside JSX tags
content = re.sub(r'(>\s*){(\d)}(\n\s*)', r'\1{\2} ', content)

# Write back
with open('components/landing/TrustSafetyShowcase.tsx', 'w') as f:
    f.write(content)

print("File fixed!")
