import re

with open('components/Calculators.tsx', 'r') as f:
    content = f.read()

# We need to extract states. Let's just find all `const [name, setName] = useState...`
states = re.findall(r'^\s*const\s+\[[a-zA-Z0-9_]+,\s+set[a-zA-Z0-9_]+\]\s*=\s*useState.*?;', content, re.MULTILINE)

# We need to extract calculation functions. Let's find `const calculateX = () => { ... };`
funcs = re.findall(r'^\s*const\s+calculate[a-zA-Z0-9_]+\s*=\s*\([^\)]*\)\s*=>\s*\{.*?\n\s*\};\n', content, re.MULTILINE | re.DOTALL)

print(f"Found {len(states)} states and {len(funcs)} functions")
