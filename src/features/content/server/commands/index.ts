// Every feed-post command, by stage (./source.ts and ./suggest.ts, ./ideas.ts, ./outline.ts, ./structures.ts, ./look.ts, ./images.ts, ./render.ts, ./review.ts, ./back.ts,
// ./market.ts, ./blog-links.ts for posts and blogs linked both ways, and ./restore.ts for the history) over the machinery they share (./shared.ts, and ./check.ts for the source check
// that runs by itself). Callers import from here.

export { discardChanges, editLive, goBack, withdrawFromReview } from './back'
export {
  approveBlogText,
  editBlogOutline,
  editBlogSection,
  embedPostSlides,
  pickBlogAngle,
  writeBlog,
} from './blog'
export { linkToBlog, makeBlogFromPost, makePostsFromBlog } from './blog-links'
export { moreIdeas, pickIdeas } from './ideas'
export { drawImages, editImageScene, nudgeImage, planImages, skipPictures } from './images'
export { setLook, setPreset, setSlideLayout } from './look'
export { makeMarket, rewordMarket } from './market'
export { editPostOutline, setOutlineFormat, writeSlides } from './outline'
export {
  type ArtChoice,
  chooseCover,
  earlierArt,
  type LightEdit,
  lightEdit,
  makeCovers,
  removeClaim,
  renderPost,
  retryArt,
} from './render'
export { restoreVersion } from './restore'
export {
  applySourceWording,
  approveAndPublish,
  checkSource,
  markOpinion,
  saveSettings,
  sendBack,
  sendToReview,
} from './review'
export {
  type Actor,
  attempt,
  command,
  type Drawn,
  draw,
  open,
  putRender,
  type Saved,
  save,
  stamp,
} from './shared'
export {
  addFact,
  addResearchSource,
  continueWithSource,
  type Made,
  makePost,
  remakeFromSource,
  removeFact,
  startFeedPost,
} from './source'
export {
  approveStructure,
  choosePage,
  chooseTheme,
  draftPost,
  editSlot,
  fixUnbound,
  type Measured,
  measureSlot,
  nudgeSlide,
  nudgeVersion,
  pickStructure,
  redraftSlide,
  reopenStructures,
  tickTemplates,
  useSlide,
} from './structures'
export { type Researched, researchClaim, type Suggested, suggestSources } from './suggest'
