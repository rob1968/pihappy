# translate_dutch.py
import json
import os
import re
import time
from deep_translator import GoogleTranslator
from pathlib import Path
import uuid # For more unique markers
import copy # For deep copying original data

# --- Configuration ---
SOURCE_LANG = 'en'
TARGET_LANG = 'nl'
SOURCE_FILE = Path('frontend/public/locales') / SOURCE_LANG / 'translation.json'
OUTPUT_DIR_BASE = Path('frontend/public/locales')
# Regex patterns - capture group is important
PLACEHOLDER_PATTERN = re.compile(r'({{.*?}})')
# Capture <1>content</1>, <br/>, <b> etc.
TAG_PATTERN = re.compile(r'(<\d+>.*?</\d+>|<[^>]*?/>|<[a-zA-Z]+>)')
CUSTOM_MARKER_PATTERN = re.compile(r'(/.*?/)') # Pattern for //...//

# --- Helper Functions ---

def generate_marker(prefix):
    """Generates a unique marker unlikely to be translated."""
    return f"__@@{prefix}_{uuid.uuid4().hex[:6]}@@__"

def preserve_elements(text, pattern, prefix, storage):
    """Generic function to replace elements matching a pattern with markers."""
    elements_found = {}
    def replacer(match):
        element = match.group(0)
        for marker, stored_element in elements_found.items():
            if stored_element == element:
                return f" {marker} "
        marker = generate_marker(prefix)
        elements_found[marker] = element
        return f" {marker} "
    processed_text = pattern.sub(replacer, text)
    storage.update(elements_found)
    return processed_text

def restore_elements(text, storage):
    """Restores elements from markers, removing extra spaces."""
    restored_text = text
    for marker, element in storage.items():
        restored_text = restored_text.replace(f" {marker} ", element)
        restored_text = restored_text.replace(marker, element) # Fallback
    return restored_text

def translate_value(value, translator, original_value):
    """Translates a string value, preserving placeholders, tags, and custom markers.
       If a colon exists, only translates the part before the first colon."""
    if not isinstance(value, str) or not value.strip():
        return value

    # Check for colon
    if ':' in value:
        parts = value.split(':', 1)
        text_to_translate = parts[0]
        text_to_keep = ':' + parts[1] # Keep colon and everything after

        # Translate only the first part
        placeholders_part1 = {}
        tags_part1 = {}
        custom_markers_part1 = {} # Storage for //...// markers
        processed_text_part1 = preserve_elements(text_to_translate, TAG_PATTERN, "TAG", tags_part1)
        processed_text_part1 = preserve_elements(processed_text_part1, PLACEHOLDER_PATTERN, "PH", placeholders_part1)
        processed_text_part1 = preserve_elements(processed_text_part1, CUSTOM_MARKER_PATTERN, "CM", custom_markers_part1) # Preserve //...//
        all_markers_part1 = set(placeholders_part1.keys()) | set(tags_part1.keys()) | set(custom_markers_part1.keys()) # Include custom markers

        if not processed_text_part1.strip(): # If only markers remain in part 1
             translated_part1 = text_to_translate # Keep original part 1
        else:
            try:
                time.sleep(0.15)
                translated_processed_part1 = translator.translate(processed_text_part1)

                if not translated_processed_part1:
                    print(f"Warning: Translation returned empty for part: '{processed_text_part1}'. Keeping original part.")
                    translated_part1 = text_to_translate # Keep original part 1
                else:
                    # Attempt restoration even if markers might be corrupted
                    # Combine all marker types for restoration
                    all_stored_markers_part1 = {**placeholders_part1, **tags_part1, **custom_markers_part1}
                    translated_part1 = restore_elements(translated_processed_part1, all_stored_markers_part1)

            except Exception as e:
                print(f"Warning: Translation failed for part '{processed_text_part1}'. Error: {e}. Keeping original part.")
                translated_part1 = text_to_translate # Keep original part 1

        # Combine translated part 1 with original part 2
        return translated_part1 + text_to_keep

    else:
        # No colon, translate the whole string
        placeholders = {}
        tags = {}
        custom_markers = {} # Storage for //...// markers
        processed_text = preserve_elements(value, TAG_PATTERN, "TAG", tags)
        processed_text = preserve_elements(processed_text, PLACEHOLDER_PATTERN, "PH", placeholders)
        processed_text = preserve_elements(processed_text, CUSTOM_MARKER_PATTERN, "CM", custom_markers) # Preserve //...//
        all_markers = set(placeholders.keys()) | set(tags.keys()) | set(custom_markers.keys()) # Include custom markers

        if not processed_text.strip():
            return original_value

        try:
            time.sleep(0.15)
            translated_processed_text = translator.translate(processed_text)

            if not translated_processed_text:
                print(f"Warning: Translation returned empty for: '{processed_text}'. Keeping original.")
                return original_value

            # Safety check removed

            # Combine all marker types for restoration
            all_stored_markers = {**placeholders, **tags, **custom_markers}
            translated_value = restore_elements(translated_processed_text, all_stored_markers)
            return translated_value

        except Exception as e:
            print(f"Warning: Translation failed for '{processed_text}'. Error: {e}. Keeping original.")
            return original_value

def translate_data(data, translator, original_data):
    """Recursively translates string values, passing original for fallback."""
    if isinstance(data, dict):
        translated_dict = {}
        for key, value in data.items():
            original_sub_data = original_data.get(key) if isinstance(original_data, dict) else None
            translated_dict[key] = translate_data(value, translator, original_sub_data)
        return translated_dict
    elif isinstance(data, list):
        translated_list = []
        for i, item in enumerate(data):
             original_item = original_data[i] if isinstance(original_data, list) and i < len(original_data) else None
             translated_list.append(translate_data(item, translator, original_item))
        return translated_list
    elif isinstance(data, str):
        return translate_value(data, translator, original_data if isinstance(original_data, str) else data)
    else:
        return data

# --- Main Script ---

if not SOURCE_FILE.exists():
    print(f"Error: Source file not found at {SOURCE_FILE}")
    exit(1)

try:
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        source_data = json.load(f)
    print(f"Loaded source translations from {SOURCE_FILE}")
except Exception as e:
    print(f"Error loading source file {SOURCE_FILE}: {e}")
    exit(1)

original_source_data = copy.deepcopy(source_data) # For fallback

print(f"\n--- Translating to {TARGET_LANG} ---")

output_dir = OUTPUT_DIR_BASE / TARGET_LANG
output_dir.mkdir(parents=True, exist_ok=True)
output_file = output_dir / 'translation.json'

try:
    translator = GoogleTranslator(source=SOURCE_LANG, target=TARGET_LANG)
    translated_data = translate_data(source_data, translator, original_source_data)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(translated_data, f, ensure_ascii=False, indent=2)
    print(f"Successfully attempted translation and saved to {output_file}")

except Exception as e:
    print(f"Error processing language {TARGET_LANG}: {e}")

print("\n--- Translation process finished ---")
print(f"IMPORTANT: Please review the generated file '{output_file}' CAREFULLY for accuracy and correctness of placeholders/tags.")