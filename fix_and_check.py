import sys
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Join split className strings
    # Pattern 1: className={`...`} across lines
    def join_template_classnames(text):
        def replacer(match):
            inner = match.group(1)
            # Join lines and collapse multiple spaces, but preserve ${...} logic
            # This is tricky if there's multi-line code inside ${}
            # Heuristic: just join lines and replace newlines with spaces
            lines = inner.splitlines()
            joined = " ".join(line.strip() for line in lines)
            joined = re.sub(r'\s+', ' ', joined)
            return f'className={{`{joined}`}}'

        return re.sub(r'className=\{`([^`]*)\}`', replacer, text, flags=re.DOTALL)

    # Pattern 2: className="foo " + "bar" (though none were found, let's be safe)
    def join_plus_classnames(text):
        # className="foo " + "bar" -> className="foo bar"
        return re.sub(r'className="([^"]*)"\s*\+\s*"([^"]*)"', r'className="\1\2"', text)

    new_content = join_template_classnames(content)
    new_content = join_plus_classnames(new_content)

    changed = (new_content != content)
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Joined split className strings in {filepath}")

    # Tag balance check
    # Remove strings and template literals to avoid false positives
    check_text = re.sub(r'`[^`]*`', '`template`', new_content)
    check_text = re.sub(r'"[^"]*"', '"string"', check_text)
    check_text = re.sub(r"'[^']*'", "'string'", check_text)
    # Remove comments
    check_text = re.sub(r'\{/\*.*?\*/\}', '', check_text, flags=re.DOTALL)
    check_text = re.sub(r'//.*', '', check_text)

    # Simple stack based tag checker
    tags = re.findall(r'<(/?)([a-zA-Z0-9]+)(?:\s+[^>]*?)?(/?)(?<!=)>', check_text)

    stack = []
    errors = []

    # Tags to ignore (common non-JSX or self-closing that might miss the /)
    # Actually, in JSX, if it's not self-closing it MUST have a closing tag.
    # But things like <input> in HTML are self-closing, in JSX they are <input />

    # We only care about tags that are clearly JSX (Uppercase or known common ones)
    valid_jsx_tags = {
        'div', 'span', 'main', 'header', 'footer', 'section', 'button', 'input', 'select',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g', 'defs',
        'clipPath', 'mask', 'use', 'label', 'form', 'textarea', 'option', 'ul', 'li', 'ol', 'nav',
        'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'img', 'video', 'audio', 'canvas', 'iframe'
    }

    for prefix, name, suffix in tags:
        if name[0].isdigit(): continue # Ignore things like <10
        if not (name[0].isupper() or name in valid_jsx_tags): continue

        if suffix == '/': # Self-closing
            continue
        if prefix == '/': # Closing tag
            if not stack:
                errors.append(f"Unexpected closing tag </{name}>")
            else:
                last_name = stack.pop()
                if last_name != name:
                    errors.append(f"Mismatched tag: opening <{last_name}> closed by </{name}>")
        else: # Opening tag
            stack.append(name)

    for name in stack:
        errors.append(f"Unclosed tag <{name}>")

    if errors:
        print(f"Tag balance errors in {filepath}:")
        for err in errors[:10]: # Show first 10
            print(f"  {err}")
        if len(errors) > 10:
            print(f"  ... and {len(errors)-10} more")
    else:
        print(f"Tags are 100% balanced in {filepath}")

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        process_file(arg)
