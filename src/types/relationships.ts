export type RelationType =
  | 'BLOCKS'
  | 'BLOCKED_BY'
  | 'DEPENDS_ON'
  | 'RELATED_TO'
  | 'CAUSES'
  | 'CAUSED_BY';

export interface IssueRelationship {
  fromIssueId: string;
  toIssueId: string;
  type: RelationType;
  reason: string;
  priority: number;
}
