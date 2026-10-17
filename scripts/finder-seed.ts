// Seeds the finder's vector table, course_doc, from src/features/finder/data/catalogue.ts. Idempotent:
// it embeds only the courses that are new, whose name or description changed, or that another model
// embedded; it rewrites every catalogue row's other columns and deletes the rows the catalogue dropped.
//   DATABASE_URL=… GOOGLE_CLOUD_PROJECT=… GOOGLE_CLOUD_LOCATION=global bun run finder:seed
// Production runs it as a Cloud Run job from the image's bundle, dist/finder-seed.js
// (docs/hackathon/deploy.md §6b). Under AI_PROVIDER=fake it stores the fake vectors, labelled 'fake'.

import { inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const { sha256Hex } = await import('../src/features/content/server/hash')
const { FINDER_COURSES, FINDER_EXTRAS } = await import('../src/features/finder/data/catalogue')
const { seedPlan } = await import('../src/features/finder/model/seed-plan')
const { embedAll, embedModelName } = await import('../src/features/finder/server/embed')
const { cityOf } = await import('../src/features/engine/catalogue')
const { courseDoc } = await import('../src/shared/lib/db/schema')

/** Further attempts per text when the model says too many requests (429): eight in all. */
const RETRIES = 7
/** Rows per insert statement: each carries a 768-number vector. */
const CHUNK = 100

const model = embedModelName()

// 1. Each course's text and its hash.
const extraById = new Map(FINDER_EXTRAS.map((e) => [e.courseId, e]))
const courses = FINDER_COURSES.map((course) => {
  const extra = extraById.get(course.id)
  if (!extra) throw new Error(`No finder extra for ${course.id}`)
  const text = `${course.name}. ${extra.description}`
  return { course, extra, text, textHash: sha256Hex(text) }
})

const client = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(client)

try {
  // 2. What is stored, and the plan.
  const stored = await db
    .select({
      id: courseDoc.id,
      textHash: courseDoc.textHash,
      embeddingModel: courseDoc.embeddingModel,
    })
    .from(courseDoc)
  const plan = seedPlan(
    courses.map((c) => ({ id: c.course.id, textHash: c.textHash })),
    stored,
    model,
  )

  // 3. Embed what changed, one text per call, backing off on 429.
  const textById = new Map(courses.map((c) => [c.course.id, c.text]))
  const embedded = await embedAll(
    plan.embed.map((id) => textById.get(id) ?? ''),
    'RETRIEVAL_DOCUMENT',
    {
      retries: RETRIES,
      onProgress: (done, total) => {
        if (done % 50 === 0) console.log(`embedded ${done}/${total}`)
      },
    },
  )
  const vectors = new Map(plan.embed.map((id, i) => [id, embedded[i]]))

  // 4. Upsert every catalogue row (a kept row keeps its stored vector) and delete the dropped ones.
  const rows = courses.map(({ course, extra, textHash }) => ({
    id: course.id,
    name: course.name,
    university: course.university,
    cityId: cityOf(course).id,
    level: course.level,
    field: course.field,
    graphField: extra.graphField,
    years: course.years,
    feeK: course.feeK,
    niche: extra.niche,
    description: extra.description,
    textHash,
    embeddingModel: model,
    embedding:
      vectors.get(course.id) ??
      sql`(select ${courseDoc.embedding} from ${courseDoc} where ${courseDoc.id} = ${course.id})`,
  }))
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await tx
        .insert(courseDoc)
        .values(rows.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: courseDoc.id,
          set: {
            name: sql`excluded.name`,
            university: sql`excluded.university`,
            cityId: sql`excluded.city_id`,
            level: sql`excluded.level`,
            field: sql`excluded.field`,
            graphField: sql`excluded.graph_field`,
            years: sql`excluded.years`,
            feeK: sql`excluded.fee_k`,
            niche: sql`excluded.niche`,
            description: sql`excluded.description`,
            textHash: sql`excluded.text_hash`,
            embeddingModel: sql`excluded.embedding_model`,
            embedding: sql`excluded.embedding`,
            updatedAt: sql`now()`,
          },
        })
    }
    if (plan.remove.length > 0) await tx.delete(courseDoc).where(inArray(courseDoc.id, plan.remove))
  })

  // 5. Report.
  console.log(`embedded ${plan.embed.length} of ${courses.length} · removed ${plan.remove.length}`)
} catch (error) {
  console.error('✗ finder seed failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
