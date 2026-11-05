export type CloseIdeaStrategy = 'denied' | 'close_master_and_followers' | 'followers_only';

export function chooseCloseIdeaStrategy(isOwner: boolean, openMasterPositions: number): CloseIdeaStrategy {
  if (!isOwner) return 'denied';
  return openMasterPositions > 0 ? 'close_master_and_followers' : 'followers_only';
}

export function isOpenCopyRow(row: { status: string; broker_ticket: string | null }): boolean {
  return row.status === 'open' && Boolean(row.broker_ticket?.trim());
}