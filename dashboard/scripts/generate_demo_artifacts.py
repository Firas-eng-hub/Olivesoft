"""Create clearly labelled static sample files for the dashboard demo.

These files are fixtures. Live proposal generation belongs in n8n.
Uses only the Python standard library so it can be rerun without extra packages.
"""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape


OUT = Path(__file__).resolve().parents[1] / "public" / "demo"
OUT.mkdir(parents=True, exist_ok=True)


def make_pdf(path: Path) -> None:
    lines = [
        "OLIVESOFT / DEMO PROPOSAL",
        "Intelligence-led tender response",
        "This is a static sample for the dashboard demonstration.",
        "It is not a generated response to any displayed tender.",
        "Live, evidence-grounded exports will be provided by n8n.",
    ]
    stream = ["BT", "/F1 28 Tf", "55 520 Td", f"({lines[0]}) Tj", "/F1 17 Tf"]
    for line in lines[1:]:
        stream.extend(["0 -47 Td", f"({line}) Tj"])
    stream.append("ET")
    content = "\n".join(stream).encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream",
    ]
    data = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(data)
    data.extend(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    data.extend(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    path.write_bytes(data)


def shape(shape_id: int, name: str, text: str, y: int, size: int, color: str) -> str:
    return f'''<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="{escape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="800000" y="{y}"/><a:ext cx="10600000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="{size}" b="1"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:rPr><a:t>{escape(text)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>'''


def make_pptx(path: Path) -> None:
    ns = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
    sp_tree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    slides = [
        ("OLIVESOFT", "DEMO PROPOSAL", "Static fixture for the intelligence dashboard"),
        ("DEMONSTRATION ONLY", "Evidence before claims", "Real proposals will be produced by the n8n workflow"),
    ]
    files = {}
    files["[Content_Types].xml"] = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    files["_rels/.rels"] = '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    files["docProps/core.xml"] = '''<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>OliveSoft Demo Proposal</dc:title><dc:creator>OliveSoft</dc:creator></cp:coreProperties>'''
    files["docProps/app.xml"] = '''<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>OliveSoft Demo</Application><Slides>2</Slides></Properties>'''
    files["ppt/presentation.xml"] = f'''<?xml version="1.0" encoding="UTF-8"?><p:presentation {ns}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'''
    files["ppt/_rels/presentation.xml.rels"] = '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>'''
    files["ppt/slideMasters/slideMaster1.xml"] = f'''<?xml version="1.0" encoding="UTF-8"?><p:sldMaster {ns}><p:cSld><p:spTree>{sp_tree}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'''
    files["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>'''
    files["ppt/slideLayouts/slideLayout1.xml"] = f'''<?xml version="1.0" encoding="UTF-8"?><p:sldLayout {ns} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>{sp_tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'''
    files["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'''
    files["ppt/theme/theme1.xml"] = '''<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="OliveSoft Demo"><a:themeElements><a:clrScheme name="OliveSoft"><a:dk1><a:srgbClr val="061827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0D3344"/></a:dk2><a:lt2><a:srgbClr val="ECFFFC"/></a:lt2><a:accent1><a:srgbClr val="11D5C6"/></a:accent1><a:accent2><a:srgbClr val="4FE1B0"/></a:accent2><a:accent3><a:srgbClr val="1FBFE2"/></a:accent3><a:accent4><a:srgbClr val="F3B774"/></a:accent4><a:accent5><a:srgbClr val="7DECDC"/></a:accent5><a:accent6><a:srgbClr val="F58389"/></a:accent6><a:hlink><a:srgbClr val="11D5C6"/></a:hlink><a:folHlink><a:srgbClr val="11D5C6"/></a:folHlink></a:clrScheme><a:fontScheme name="OliveSoft"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="OliveSoft"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'''
    for index, (kicker, title, subtitle) in enumerate(slides, 1):
        shapes = shape(2, "Kicker", kicker, 1300000, 1900, "66E9D7") + shape(3, "Title", title, 2300000, 3900, "FFFFFF") + shape(4, "Subtitle", subtitle, 3450000, 1700, "C0E1E2")
        files[f"ppt/slides/slide{index}.xml"] = f'''<?xml version="1.0" encoding="UTF-8"?><p:sld {ns}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="082C3F"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{sp_tree}{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''
        files[f"ppt/slides/_rels/slide{index}.xml.rels"] = '''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'''
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)


if __name__ == "__main__":
    make_pdf(OUT / "OliveSoft_Proposal_DEMO.pdf")
    make_pptx(OUT / "OliveSoft_Proposal_DEMO.pptx")
    print(f"Created sample files in {OUT}")
