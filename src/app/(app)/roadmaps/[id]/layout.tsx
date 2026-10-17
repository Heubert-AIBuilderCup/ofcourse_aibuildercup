import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import {
  courseDetailOn,
  findCoursesAction,
  finderOn,
  finderSeedText,
  finderWhyAction,
} from '@/features/finder'
import { getProfile } from '@/features/opening/server/profile'
import { matchLine, RoadBoard, roadRedirect } from '@/features/road'
import { roadmapName, roadNames } from '@/features/roadmaps'
import { saveChoicesAction, saveRoadmapAnswersAction } from '@/features/roadmaps/actions'
import { touchOpened } from '@/features/roadmaps/server/roadmaps'
import {
  ASK_SLOTS,
  detailsByTile,
  herCountry,
  type RoadSpec,
  studentAiOff,
  studentRoadsOff,
  suggestedAsks,
  type TileAsk,
  tilePosts,
} from '@/features/roads'
import { askTileAction, roadWhyAction } from '@/features/roads/actions'
import { roadmapRoad } from '@/features/roads/server/roadmap-road'
import { readTileFeed } from '@/features/roads/server/tile-posts'
import { requireStudent } from '@/shared/lib/auth/session'

/** Each city and course tile's suggested questions, by tile id: the catalogue stays on the server. */
const asksOn = (spec: RoadSpec): Record<string, TileAsk[]> =>
  Object.fromEntries(
    ASK_SLOTS.map((slot) => spec.slots[slot].id).map((id) => [id, suggestedAsks(spec, id)]),
  )

/**
 * One of her roadmaps' board, once onboarding is closed; before that, on to where she left off. A
 * roadmap that is not hers, deleted or unknown is a 404. The board renders here once, so it stays
 * mounted (camera, session) across the board, its lesson and its route steps; those pages only
 * choose what its card column shows. It draws the road its answers match (else the closest, with a
 * line saying so and how it differs; else Priya's, marked illustrative). It opens on the roadmap's
 * stored choices, with the first arrival when she has never opened it; that she opened it is
 * recorded after the response. Its name is resolved as the list resolves it: hers, else from where
 * she is on its road. Your answers over it shows the roadmap's answers and person. A card asks why
 * its tile is on her road only when the road is built from her answers (matched or the closest),
 * and only then does a city or course card take questions, with its suggested ones. On those
 * roads a card also shows the catalogue's facts for its tile (subjects, work, jobs, the state list,
 * on the stack and the alternative the field next to the one her answers picked, and with the course
 * detail on (COURSE_DETAIL_ON=1) the fields near the course and its job market), worked out
 * here so the catalogue stays out of the browser, and lists the posts and updates about its tile
 * (read beside the roadmap, unless the roads are off; an update for one country only when she
 * stated hers). With the student AI off (STUDENT_AI_OFF=1) no card calls a model: the why keeps its
 * template and a city or course card offers its suggested questions only. With the finder on
 * (FINDER_ON=1) and a road built from her answers, the board offers Find courses, its box
 * starting with her study words.
 */
export default async function RoadmapLayout({ children, params }: LayoutProps<'/roadmaps/[id]'>) {
  const [{ user }, { id }] = await Promise.all([requireStudent(), params])
  const [profile, found, feed] = await Promise.all([
    getProfile(user.id),
    roadmapRoad(user.id, id),
    studentRoadsOff(process.env) ? null : readTileFeed(),
  ])
  const to = roadRedirect(profile)
  if (to) redirect(to)
  if (!found) notFound()
  const { roadmap, road: result } = found

  after(() => touchOpened(user.id, id))

  const road = result.road
  const name = roadmapName(roadmap, roadNames(road))
  const built = result.kind === 'matched' || result.kind === 'nearest'
  const aiOff = studentAiOff(process.env)
  const details =
    built && result.spec
      ? detailsByTile(result.spec, roadmap.answers, { detail: courseDetailOn(process.env) })
      : undefined
  const posts =
    built && result.spec && feed
      ? tilePosts(result.spec, feed, herCountry(roadmap.answers))
      : undefined

  return (
    <RoadBoard
      road={road}
      roadmap={{
        id,
        name,
        choices: roadmap.choices,
        firstVisit: roadmap.lastOpenedAt === null,
        answers: roadmap.answers,
        relative: roadmap.relative,
        tags: roadmap.tags,
      }}
      match={matchLine(result)}
      rematch={result.kind !== 'off'}
      saveChoicesAction={saveChoicesAction}
      saveRoadmapAnswersAction={saveRoadmapAnswersAction}
      whyAction={aiOff ? undefined : roadWhyAction}
      whyEnabled={built}
      askAction={built && !aiOff ? askTileAction : undefined}
      asks={built && result.spec ? asksOn(result.spec) : undefined}
      details={details}
      tilePosts={posts}
      finder={
        finderOn(process.env) && built
          ? { seed: finderSeedText(roadmap), search: findCoursesAction, why: finderWhyAction }
          : undefined
      }
    >
      {children}
    </RoadBoard>
  )
}
