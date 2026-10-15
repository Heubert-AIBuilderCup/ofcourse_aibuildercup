import { AdminPageHeader } from '@/features/admin'
import {
  approveCharacterAction,
  drawCharacterAction,
  editCharacterViewAction,
  planCharacterAction,
} from '@/features/content/comic-actions'
import { CharacterStudio } from '@/features/content/components/CharacterStudio'
import { characterOf } from '@/features/content/server/character'
import { requireBoard } from '@/shared/lib/auth/session'

const actions = {
  planCharacterAction,
  editCharacterViewAction,
  drawCharacterAction,
  approveCharacterAction,
}

/**
 * The comic character (RC9). Everyone who may see the Board reads it; editors and superadmins
 * plan, draw and approve it (canEdit decides in the studio), and the actions check again.
 */
export default async function ComicCharacterPage() {
  const { user } = await requireBoard()
  const character = await characterOf()
  return (
    <>
      <AdminPageHeader
        title="Comic character"
        lede="The one student every comic shows. Describe them, plan the views of a reference sheet, draw it, and approve it before any panel is drawn."
      />
      <CharacterStudio viewer={user} character={character} actions={actions} />
    </>
  )
}
