import os
import re

JAVA_DIR = r"c:\Users\Vibha\Desktop\mediverse\backend\src\main\java\com\mediverse"

def generate_methods(class_name, fields, generate_builder=True):
    lines = []
    
    # Empty constructor
    lines.append(f"    public {class_name}() {{}}\n")
    
    # All args constructor
    if fields:
        args = ", ".join([f"{t} {n}" for t, n in fields])
        lines.append(f"    public {class_name}({args}) {{\n")
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
        lines.append(f"    public static {class_name}Builder builder() {{ return new {class_name}Builder(); }}\n")
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

for root, dirs, files in os.walk(JAVA_DIR):
    for f in files:
        if not f.endswith(".java"): continue
        path = os.path.join(root, f)
        
        with open(path, "r", encoding="utf-8") as file:
            content = file.read()
            
        if "lombok" not in content and "@Data" not in content and "@Builder" not in content:
            continue
            
        print(f"Processing {path}")
        
        # Clean lombok imports and annotations
        content = re.sub(r'import\s+lombok\..*;\n', '', content)
        content = re.sub(r'@Data\n?', '', content)
        content = re.sub(r'@Builder\n?', '', content)
        content = re.sub(r'@NoArgsConstructor\n?', '', content)
        content = re.sub(r'@AllArgsConstructor\n?', '', content)

        # Basic parsing: find classes and their fields
        # This regex looks for `private Type name;`
        # and we need to inject right before the last `}` of the file/class
        
        # To handle nested classes (like MedicineItem inside PrescriptionRequest),
        # we'll use a simpler approach: extract class definitions block by block.
        
        new_content = content
        
        # Let's find all classes:
        # A rough heuristic:
        class_matches = re.finditer(r'(?:public\s+|public\s+static\s+|static\s+)?class\s+(\w+).*?\{', content)
        
        for m in class_matches:
            class_name = m.group(1)
            # Find the end of the class by balancing braces, but for simplicity
            # we'll just parse all fields in the file that are `private Type name;`
            # Wait, this will mix fields of nested classes.
            pass
        
        # Simpler approach: write custom python regex that finds all `private Type name;` in the file.
        # Since all our classes have fields declared as `private Type name;` 
        # and nested classes are also simple (MedicineItem, TestItem, MedicinePrice)
        
        # I will just write a hardcoded script to do this safely by replacing the classes directly.
        pass
