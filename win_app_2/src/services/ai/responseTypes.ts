import { ResponseType, RESPONSE_TYPE_INFO } from '@/types/models'

export { ResponseType, RESPONSE_TYPE_INFO }

export const RESPONSE_TABS = [
  ResponseType.Assist,
  ResponseType.WhatToSay,
  ResponseType.FollowUp,
  ResponseType.Recap,
] as const
