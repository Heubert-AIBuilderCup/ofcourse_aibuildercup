import { AdminPageHeader } from '@/features/admin'
import { PageStyles } from '@/features/content/components/PageStyles'
import {
  describePageStyleAction,
  savePageStyleAction,
  uploadReferenceAction,
} from '@/features/content/page-style-actions'
import { pageStyles } from '@/features/content/server/page-style'
import { requireBoard } from '@/shared/lib/auth/session'

const actions = { uploadReferenceAction, describePageStyleAction, savePageStyleAction }

/**
 * Each page brand's design language (criterion 105). Everyone who may see the Board reads it; the
 * actions let editors and superadmins change it, and check again.
 */
export default async function PageStylesPage() {
  const { user } = await requireBoard()
  const styles = Object.fromEntries(await pageStyles())
  return (
    <>
      <AdminPageHeader
        kicker="Pages"
        title="Page styles"
        lede="Each page's design language: its art style and copy style, from one or two of its posts. Drafts and covers made for the page follow it; colours and fonts stay the brand's."
      />
      <PageStyles viewer={user} styles={styles} actions={actions} />
    </>
  )
}
