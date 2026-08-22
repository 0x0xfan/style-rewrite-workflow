#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Extract text from Banfo PDF samples for style analysis"""

import pymupdf
import os
import json

def extract_pdf_text(pdf_path):
    """Extract text from a PDF file"""
    try:
        doc = pymupdf.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        print(f"Error extracting {pdf_path}: {e}")
        return None

def main():
    source_dir = r"D:\项目仓库\风格仿写\仿写案例库\半佛\peer_library\风格库"
    output_dir = r"D:\项目仓库\风格仿写\仿写案例库\半佛\extracted_texts"

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Get all PDF files
    pdf_files = [f for f in os.listdir(source_dir) if f.endswith('.pdf')]

    # Extract a diverse sample (first 10 for initial analysis)
    sample_files = pdf_files[:10]

    extracted = []

    for pdf_file in sample_files:
        pdf_path = os.path.join(source_dir, pdf_file)
        print(f"Extracting: {pdf_file}")

        text = extract_pdf_text(pdf_path)
        if text:
            # Save individual text file
            txt_filename = pdf_file.replace('.pdf', '.txt')
            txt_path = os.path.join(output_dir, txt_filename)

            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(text)

            extracted.append({
                'filename': pdf_file,
                'title': pdf_file.replace('.pdf', ''),
                'text_file': txt_filename,
                'char_count': len(text),
                'excerpt': text[:500]
            })

    # Save extraction manifest
    manifest_path = os.path.join(output_dir, 'extraction_manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(extracted, f, ensure_ascii=False, indent=2)

    print(f"\nExtracted {len(extracted)} articles")
    print(f"Output directory: {output_dir}")
    print(f"Manifest: {manifest_path}")

if __name__ == '__main__':
    main()
