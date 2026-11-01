export interface RepoQuery {
  type?: 'all' | 'owner' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  /** 1–100. Defaults to 100 so one page holds every portfolio repo. */
  per_page?: number;
  page?: number;
}

export type RepoQueryParams = Record<string, string | number>;

export function buildRepoQuery(overrides: RepoQuery = {}): RepoQueryParams {
  const query: RepoQuery = { per_page: 100, ...overrides };
  if (query.per_page !== undefined && (query.per_page < 1 || query.per_page > 100)) {
    throw new RangeError(`per_page must be 1–100, got ${query.per_page}`);
  }
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string | number] => entry[1] !== undefined),
  );
}
