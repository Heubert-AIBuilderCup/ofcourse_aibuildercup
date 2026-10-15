'use client'

import { createContext, useContext } from 'react'
import { ROAD_PATH } from '@/shared/lib/student-paths'

/**
 * Where the board lives (`/roadmaps/<id>`): its lesson and route links and its ways back are under
 * it. RoadBoard always provides it; ROAD_PATH is only the context's default, never a drawn board.
 */
export const BoardPath = createContext<string>(ROAD_PATH)

export const useBoardPath = () => useContext(BoardPath)
