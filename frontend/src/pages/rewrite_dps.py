import os

filepath = r"c:\Users\faceb\Desktop\โปรเจ็ค\2026\sun-planner\frontend\src\pages\DPSPlan.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

out_lines = []
in_conflict = False
keep = True

for line in lines:
    if line.startswith("<<<<<<< Updated upstream"):
        in_conflict = True
        keep = True
        continue
    elif line.startswith("======="):
        keep = False
        continue
    elif line.startswith(">>>>>>> Stashed changes"):
        in_conflict = False
        keep = True
        continue
    
    if keep:
        out_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(out_lines)

print("Conflict resolved in DPSPlan.tsx")
