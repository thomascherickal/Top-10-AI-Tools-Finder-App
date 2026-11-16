#!/usr/bin/env python3
import json
import sys

def parse_db():
    print("Parsing tools_db.txt...")
    try:
        with open('tools_db.txt', 'r', encoding='utf-8') as f:
            text = f.read()
    except FileNotFoundError:
        print("Error: tools_db.txt not found in the current directory.")
        sys.exit(1)
        
    blocks = text.split('==================================================')
    parsed_tools = []
    
    for block in blocks:
        lines = block.strip().split('\n')
        tool = {'reviews': []}
        has_data = False
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if ':' not in line:
                continue
                
            key, val = line.split(':', 1)
            key = key.strip()
            val = val.strip()
            
            has_data = True
            
            if key == 'ID':
                tool['id'] = int(val)
            elif key == 'NAME':
                tool['name'] = val
            elif key == 'CATEGORY':
                tool['category'] = val
            elif key == 'BUDGET':
                # Remove dollar sign if present, convert to float
                val_clean = val.replace('$', '').strip()
                tool['budget'] = float(val_clean)
            elif key == 'FREE_TIER':
                tool['freeTier'] = val.lower() == 'yes'
            elif key == 'LATENCY':
                tool['latency'] = val
            elif key == 'TEAM_SIZE':
                tool['teamSize'] = val
            elif key == 'URL':
                tool['url'] = val
            elif key == 'SCORE':
                tool['score'] = int(val)
            elif key == 'COSTS':
                tool['costs'] = val
            elif key == 'DESCRIPTION':
                tool['desc'] = val
            elif key in ['REVIEW_POSITIVE_1', 'REVIEW_POSITIVE_2', 'REVIEW_NEGATIVE_1']:
                if ':' in val:
                    source, r_text = val.split(':', 1)
                    source = source.strip()
                    r_text = r_text.strip()
                else:
                    source = 'User Review'
                    r_text = val.strip()
                
                # Remove quotes if the parsed text is already wrapped in them to prevent double-escaping
                if r_text.startswith('"') and r_text.endswith('"'):
                    r_text = r_text[1:-1]
                    
                r_type = 'positive' if 'POSITIVE' in key else 'negative'
                tool['reviews'].append({
                    'type': r_type,
                    'source': source,
                    'text': r_text
                })
        
        if has_data and 'id' in tool:
            parsed_tools.append(tool)
            
    print(f"Successfully parsed {len(parsed_tools)} tools.")
    return parsed_tools

def compile_html(tools):
    print("Reading index.html...")
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            html = f.read()
    except FileNotFoundError:
        print("Error: index.html not found.")
        sys.exit(1)
        
    start_idx = html.find('const TOOLS = [')
    end_idx = html.find('// ─── SCORING ENGINE ───')
    
    if start_idx == -1:
        print("Error: Could not find 'const TOOLS = [' in index.html")
        sys.exit(1)
    if end_idx == -1:
        print("Error: Could not find '// ─── SCORING ENGINE ───' in index.html")
        sys.exit(1)
    if end_idx <= start_idx:
        print("Error: End marker appears before start marker in index.html")
        sys.exit(1)
        
    print("Formatting database to compact JSON...")
    # Compact JSON minimizes HTML payload and JS parse time
    tools_json = json.dumps(tools, separators=(',', ':'), ensure_ascii=False)
    
    # Reconstruct the HTML file
    new_html = html[:start_idx] + "const TOOLS = " + tools_json + ";\n\n" + html[end_idx:]
    
    print("Writing updated index.html...")
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print("HTML compilation complete!")

if __name__ == '__main__':
    tools = parse_db()
    compile_html(tools)
