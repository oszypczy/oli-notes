#!/bin/bash
# Generates tree.json from the PDF directory structure
# Usage: bash generate-tree.sh [pdfs_directory]
# Default directory: ~/data/notes/pdfs

PDFS_DIR="${1:-$HOME/data/notes/pdfs}"
OUTPUT="$PDFS_DIR/tree.json"

if [ ! -d "$PDFS_DIR" ]; then
  echo "Error: Directory $PDFS_DIR does not exist" >&2
  exit 1
fi

python3 -c "
import os, json, sys, re

def make_label_folder(name):
    return re.sub(r'[-_]', ' ', name).title()

def make_label_file(name):
    return re.sub(r'\.pdf$', '', name, flags=re.IGNORECASE).upper()

def generate_tree(directory, url_prefix):
    items = []
    try:
        entries = sorted(os.listdir(directory))
    except PermissionError:
        return items

    for entry in entries:
        full_path = os.path.join(directory, entry)
        if os.path.isdir(full_path):
            children = generate_tree(full_path, url_prefix + '/' + entry)
            if children:
                items.append({
                    'type': 'folder',
                    'name': entry,
                    'label': make_label_folder(entry),
                    'children': children
                })
        elif entry.lower().endswith('.pdf') and os.path.isfile(full_path):
            items.append({
                'type': 'file',
                'name': entry,
                'label': make_label_file(entry),
                'path': url_prefix + '/' + entry
            })
    return items

tree = generate_tree(sys.argv[1], '/pdfs')
json.dump(tree, open(sys.argv[2], 'w'), indent=4, ensure_ascii=False)
" "$PDFS_DIR" "$OUTPUT"

echo "Generated $OUTPUT"
