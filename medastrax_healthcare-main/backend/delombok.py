import os
import re

JAVA_DIR = r"c:\Users\Vibha\Desktop\mediverse\backend\src\main\java\com\mediverse"

def generate_methods(class_name, fields, generate_builder=True):
    lines = []
    
    # Constructors
    lines.append(f"    public {class_name}() {{}}\n")
    
    constructor_args = ", ".join([f"{t} {n}" for t, n in fields])
    lines.append(f"    public {class_name}({constructor_args}) {{\n")
    for t, n in fields:
        lines.append(f"        this.{n} = {n};\n")
    lines.append("    }\n")
    
    # Getters and Setters
    for t, n in fields:
        cap_n = n[0].upper() + n[1:]
        lines.append(f"    public {t} get{cap_n}() {{ return this.{n}; }}\n")
        lines.append(f"    public void set{cap_n}({t} {n}) {{ this.{n} = {n}; }}\n")

    # Builder
    if generate_builder:
        lines.append(f"\n    public static {class_name}Builder builder() {{ return new {class_name}Builder(); }}\n")
        lines.append(f"    public static class {class_name}Builder {{\n")
        for t, n in fields:
            lines.append(f"        private {t} {n};\n")
        for t, n in fields:
            lines.append(f"        public {class_name}Builder {n}({t} {n}) {{ this.{n} = {n}; return this; }}\n")
        lines.append(f"        public {class_name} build() {{\n")
        lines.append(f"            return new {class_name}({', '.join([n for t, n in fields])});\n")
        lines.append("        }\n")
        lines.append("    }\n")

    return "\n".join(lines)

for root, _, files in os.walk(JAVA_DIR):
    for f in files:
        if not f.endswith(".java"): continue
        path = os.path.join(root, f)
        with open(path, "r", encoding="utf-8") as file:
            content = file.read()
            
        if "@Data" not in content and "@Builder" not in content and "lombok" not in content:
            continue
            
        # Clean lombok imports
        content = re.sub(r'import\s+lombok\..*;\n', '', content)
        
        # Clean lombok annotations
        content = re.sub(r'@Data\n', '', content)
        content = re.sub(r'@Builder\n', '', content)
        content = re.sub(r'@NoArgsConstructor\n', '', content)
        content = re.sub(r'@AllArgsConstructor\n', '', content)

        # Process each class
        # Simple parser for class
        classes = re.findall(r'public (?:static )?class (\w+)\s*{([^}]*)}', content, re.DOTALL)
        
        # We need a better parser for nested classes because regex fails on nested braces.
        # Let's do a line-by-line replacement approach.
