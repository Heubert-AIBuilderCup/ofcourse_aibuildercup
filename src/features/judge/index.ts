// Judge access, for the two sign-in pages (server components): the switch that shows the
// "Judge access" link and the dialog it opens. The actions are in ./actions ('use server'); pages
// import those and pass them to the dialog, as the other features do.

export { JudgeAccess, type JudgeStoryCard } from './components/JudgeAccess'
export { isJudgeEmail } from './model/accounts'
export { judgeAccessOn } from './model/passcode'
