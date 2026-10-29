export interface ChainBid {
  id: string;
  hash: string;
  previousHash: string | null;
  createdAt: Date;
}

function compareBids(a: ChainBid, b: ChainBid): number {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

export function orderBidsByChain<T extends ChainBid>(
  bids: T[],
): T[] {
  const children = new Map<string | null, T[]>();

  for (const bid of bids) {
    const group = children.get(bid.previousHash) ?? [];
    group.push(bid);
    children.set(bid.previousHash, group);
  }

  for (const group of children.values()) {
    group.sort(compareBids);
  }

  const ordered: T[] = [];
  const visited = new Set<string>();

  function visit(previousHash: string | null): void {
    const nextBids = children.get(previousHash) ?? [];

    for (const bid of nextBids) {
      if (visited.has(bid.id)) {
        continue;
      }

      visited.add(bid.id);
      ordered.push(bid);

      visit(bid.hash);
    }
  }

  visit(null);

  const remaining = [...bids]
    .filter((bid) => !visited.has(bid.id))
    .sort(compareBids);

  for (const bid of remaining) {
    if (visited.has(bid.id)) {
      continue;
    }

    visited.add(bid.id);
    ordered.push(bid);
    visit(bid.hash);
  }

  return ordered;
}