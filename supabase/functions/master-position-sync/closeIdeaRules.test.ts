import { chooseCloseIdeaStrategy, isOpenCopyRow } from './closeIdeaRules.ts';

Deno.test('only the owning mentor may close an Idea', () => {
  if (chooseCloseIdeaStrategy(false, 1) !== 'denied') {
    throw new Error('A non-owner must be denied even when a Master trade is open');
  }
});

Deno.test('an Idea without an open Master position targets followers only', () => {
  if (chooseCloseIdeaStrategy(true, 0) !== 'followers_only') {
    throw new Error('No open Master position must select the follower-only path');
  }
});

Deno.test('an open Master position uses the existing Master-and-follower close path', () => {
  if (chooseCloseIdeaStrategy(true, 1) !== 'close_master_and_followers') {
    throw new Error('An open linked Master position must use the existing close path');
  }
});

Deno.test('closed copies and rows without broker tickets are not close candidates', () => {
  const rows = [
    { status: 'open', broker_ticket: '1386367119' },
    { status: 'closed', broker_ticket: '71120121' },
    { status: 'open', broker_ticket: null },
  ];
  const candidates = rows.filter(isOpenCopyRow);
  if (candidates.length !== 1 || candidates[0]?.broker_ticket !== '1386367119') {
    throw new Error('Only an open row with a broker ticket may be closed');
  }
});