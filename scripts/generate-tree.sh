#!/bin/bash
# Generates tree.json from the PDF directory structure
# Usage: bash generate-tree.sh [pdfs_directory]
# Default directory: ~/data/notes/pdfs

PDFS_DIR="${1:-$HOME/data/notes/pdfs}"
OUTPUT="$PDFS_DIR/tree.json"

generate_tree() {
  local dir="$1"
  local url_prefix="$2"
  local items=()

  # Collect folders (sorted)
  for folder in "$dir"/*/; do
    [ -d "$folder" ] || continue
    local name=$(basename "$folder")
    local label=$(echo "$name" | sed 's/[-_]/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')
    local children=$(generate_tree "$folder" "$url_prefix/$name")
    items+=("{\"type\":\"folder\",\"name\":\"$name\",\"label\":\"$label\",\"children\":$children}")
  done

  # Collect PDF files (sorted)
  for file in "$dir"/*.pdf; do
    [ -f "$file" ] || continue
    local name=$(basename "$file")
    local label=$(echo "$name" | sed 's/\.pdf$//i' | tr '[:lower:]' '[:upper:]')
    items+=("{\"type\":\"file\",\"name\":\"$name\",\"label\":\"$label\",\"path\":\"$url_prefix/$name\"}")
  done

  # Join with commas
  local result="["
  local first=true
  for item in "${items[@]}"; do
    if [ "$first" = true ]; then
      first=false
    else
      result+=","
    fi
    result+="$item"
  done
  result+="]"

  echo "$result"
}

if [ ! -d "$PDFS_DIR" ]; then
  echo "Error: Directory $PDFS_DIR does not exist" >&2
  exit 1
fi

generate_tree "$PDFS_DIR" "/pdfs" | python3 -m json.tool > "$OUTPUT" 2>/dev/null || generate_tree "$PDFS_DIR" "/pdfs" > "$OUTPUT"

echo "Generated $OUTPUT"
