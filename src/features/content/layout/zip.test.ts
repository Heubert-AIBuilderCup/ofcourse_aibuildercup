import { describe, expect, it } from 'bun:test'
import { strFromU8, unzipSync } from 'fflate'
import { exportName, exportZip } from './zip'

// The export download: its file name and its contents, built from stored bytes (criterion 67).

describe('exportName', () => {
  it('is <page>_<post>_<platform>.zip in lower-case slugs', () => {
    expect(exportName('Cerebral', 'Paid work & grades', 'instagram')).toBe(
      'cerebral_paid-work-grades_instagram.zip',
    )
    expect(exportName('OfCourse Main', '  The 20-hour line!  ', 'linkedin')).toBe(
      'ofcourse-main_the-20-hour-line_linkedin.zip',
    )
  })

  it('keeps only ASCII letters, digits and dashes, so the name is safe in a header', () => {
    expect(exportName('Café', 'Résumé "tips"; \r\n/..', 'instagram')).toBe(
      'cafe_resume-tips_instagram.zip',
    )
    expect(exportName('Cerebral', '&&&', 'instagram')).toBe('cerebral_post_instagram.zip')
  })
})

describe('exportZip', () => {
  it('holds an SVG and a PNG per slide and caption.txt, byte for byte', () => {
    const pngs = [new Uint8Array([137, 80, 78, 71, 1]), new Uint8Array([137, 80, 78, 71, 2])]
    const svgs = ['<svg>one · ½</svg>', '<svg>two</svg>']
    const zip = exportZip({ svgs, pngs, caption: 'Working up to 20 hours.\n\n#studyabroad' })
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual([
      'caption.txt',
      'slide-1.png',
      'slide-1.svg',
      'slide-2.png',
      'slide-2.svg',
    ])
    expect(files['slide-1.png']).toEqual(pngs[0])
    expect(files['slide-2.png']).toEqual(pngs[1])
    expect(strFromU8(files['slide-1.svg'])).toBe(svgs[0])
    expect(strFromU8(files['caption.txt'])).toBe('Working up to 20 hours.\n\n#studyabroad')
  })
})

describe('the slides download (Images on)', () => {
  it('is named <page>_<post>_slides.zip', () => {
    expect(exportName('Cerebral', 'Paid work & grades', 'slides')).toBe(
      'cerebral_paid-work-grades_slides.zip',
    )
  })

  it('holds only the slides when there is no caption', () => {
    const zip = exportZip({ svgs: ['<svg/>'], pngs: [new Uint8Array([137, 80])] })
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(['slide-1.png', 'slide-1.svg'])
  })
})
