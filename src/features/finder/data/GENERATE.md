# How the finder's sample catalogue was generated

The raw courses in `raw/<field>.json` were written by language-model agents, one per broad field, from this brief. Code turns them into catalogue rows (`scripts/finder-build.ts`); nothing in a raw file is edited by hand towards a search query.

## Purpose

A sample catalogue for a demo. The courses are illustrative, not real offerings of these universities, and every figure shown from them is labelled sample.

## Coverage

- The usual courses of the broad field, plus every niche field in `FIELDS` (src/features/roads/data/fields.ts) under it. Each course names its broad field in `field` and the graph field it fits best in `graphField`; `niche` is true when that graph field is a niche one.
- At the campuses listed in `FINDER_CAMPUSES` (src/features/finder/data/schema.ts), as a Diploma or a Master's, one or two years long.
- Fees typical for the level, in thousands of Australian dollars a year (`feeK`): Diploma 12–28, Master's 26–60.

- Teaching, social work and hospitality (`education.json`, `social-work.json`, `hospitality.json`, 18 Oct) hold each road course in those areas (src/features/roads/data/courses.ts: the same name, campus, level, length and fee) and one TAFE Perth Diploma each. Their rows were appended after the kept courses by the rules alone, with no near-duplicate pass; the four Master of Social Work rows share a name, so their descriptions differ in voice and content.

## Descriptions

- Say what the course teaches and how, in plain words.
- Vary the length and the voice from course to course.
- No marketing words ("best", "leading", "top").
- No figures except the course length.
- 120–600 characters, two to four sentences.

## Units and majors

Realistic: the names a course handbook would use, one to four majors and three to eight units.

## Forbidden

- Visa or permanent-residency claims (code adds those).
- Employer names.

## Shape of a row

Each file is a JSON array of objects that pass `rawCourseSchema` (src/features/finder/data/schema.ts):

```json
{
  "name": "Master of …",
  "campusId": "one of FINDER_CAMPUSES",
  "level": "Diploma | Master's",
  "years": 1,
  "feeK": 34,
  "field": "the broad field",
  "graphField": "a FIELDS id",
  "niche": false,
  "placements": true,
  "description": "Two to four sentences.",
  "majors": ["…"],
  "units": ["…", "…", "…"]
}
```

No two rows anywhere in the catalogue share a name at the same campus.
